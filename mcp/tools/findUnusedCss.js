import fs from 'fs';
import path from 'path';
import { projectRoot } from '../utils.js';

export default function findUnusedCss() {
  const cssFiles = [];
  const codeFiles = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const fullPath = path.join(dir, f);
      let stat;
      try { stat = fs.statSync(fullPath); } catch (e) { continue; }
      if (stat.isDirectory()) {
        if (f !== 'node_modules' && f !== 'dist' && f !== 'scripts' && f !== 'migrations' && !f.startsWith('.')) {
          walk(fullPath);
        }
      } else if (f.endsWith('.css')) {
        cssFiles.push(fullPath);
      } else if (f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.html')) {
        codeFiles.push(fullPath);
      }
    }
  }
  walk(projectRoot);

  const codeContents = codeFiles.map(filePath => {
    try {
      return {
        file: path.relative(projectRoot, filePath).replace(/\\/g, '/'),
        content: fs.readFileSync(filePath, 'utf-8')
      };
    } catch (e) {
      return null;
    }
  }).filter(Boolean);

  const deadCSSReport = [];

  for (const cssFile of cssFiles) {
    const relativeCSSPath = path.relative(projectRoot, cssFile).replace(/\\/g, '/');
    try {
      const cssContent = fs.readFileSync(cssFile, 'utf-8');
      const stripped = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');
      
      const classRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)(?=(?:[^{}]*{))/g;
      const uniqueClasses = new Set();
      let match;
      while ((match = classRegex.exec(stripped)) !== null) {
        uniqueClasses.add(match[1]);
      }

      if (uniqueClasses.size === 0) continue;

      const unusedClasses = [];
      for (const className of uniqueClasses) {
        const usageRegex = new RegExp(`(?:^|[^a-zA-Z0-9_-])${className}(?:[^a-zA-Z0-9_-]|$)`);
        let isUsed = false;
        for (const codeObj of codeContents) {
          if (usageRegex.test(codeObj.content)) {
            isUsed = true;
            break;
          }
        }
        if (!isUsed) {
          unusedClasses.push(className);
        }
      }

      if (unusedClasses.length > 0) {
        deadCSSReport.push({
          file: relativeCSSPath,
          unusedClasses
        });
      }
    } catch (e) {
      // Ignore errors for individual files
    }
  }

  return deadCSSReport;
}
