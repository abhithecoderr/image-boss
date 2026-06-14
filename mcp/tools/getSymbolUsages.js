import fs from 'fs';
import path from 'path';
import { projectRoot } from '../utils.js';

export default function getSymbolUsages(symbol, contextLines = 5, maxUsages = 15) {
  const trimmed = (symbol || '').trim();
  const BLOCKED_WORDS = new Set([
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
    'else', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in',
    'instanceof', 'new', 'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try',
    'typeof', 'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'enum', 'await',
    'console', 'window', 'document', 'process', 'global', 'Object', 'Array', 'String', 'Number', 'Boolean'
  ]);

  if (!trimmed) {
    throw new Error("Symbol name cannot be empty.");
  }
  if (BLOCKED_WORDS.has(trimmed)) {
    throw new Error(`Symbol '${trimmed}' is a reserved JS keyword or common global, searching for it is not allowed to prevent output bloat.`);
  }
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(trimmed)) {
    throw new Error(`Symbol '${trimmed}' is not a valid identifier. It must start with a letter, $, or _ and contain only alphanumeric characters, $, or _.`);
  }

  const srcDir = path.join(projectRoot, 'src');
  const symbolRegex = new RegExp(`\\b${trimmed}\\b`);
  
  const definitionRegex = new RegExp(
    `\\b(const|let|var|function|class|export|export\\s+default)\\s+${trimmed}\\b|\\bfunction\\s+${trimmed}\\b|\\b${trimmed}\\s*\\([^)]*\\)\\s*{`
  );

  const importRegex = /^\s*(import\b|const\s+.*\s*=\s*require\b)/;

  let definition = null;
  const fileUsagesMap = new Map();
  let totalUsagesCount = 0;
  let truncated = false;

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    
    for (const f of files) {
      const fullPath = path.join(dir, f);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        continue;
      }
      
      if (stat.isDirectory()) {
        if (f !== 'node_modules' && f !== 'dist' && !f.startsWith('.')) {
          walk(fullPath);
        }
      } else if (f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.css')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (symbolRegex.test(content)) {
            const lines = content.split(/\r?\n/);
            const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');
            
            lines.forEach((line, idx) => {
              if (symbolRegex.test(line)) {
                if (importRegex.test(line)) {
                  return;
                }
                
                const isDef = definitionRegex.test(line);
                const start = Math.max(0, idx - contextLines);
                const end = Math.min(lines.length - 1, idx + contextLines);
                const context = lines.slice(start, end + 1).map((l, i) => `${start + i + 1}: ${l}`);
                
                const occurrence = {
                  line: idx + 1,
                  context
                };
                
                if (isDef && !definition) {
                  definition = {
                    file: relativePath,
                    ...occurrence
                  };
                } else if (!isDef) {
                  if (totalUsagesCount >= maxUsages) {
                    truncated = true;
                  } else {
                    if (!fileUsagesMap.has(relativePath)) {
                      fileUsagesMap.set(relativePath, []);
                    }
                    fileUsagesMap.get(relativePath).push(occurrence);
                    totalUsagesCount++;
                  }
                }
              }
            });
          }
        } catch (e) {
          // Ignore read errors
        }
      }
    }
  }

  walk(srcDir);
  
  const usages = [];
  for (const [file, matches] of fileUsagesMap.entries()) {
    usages.push({
      file,
      matches
    });
  }

  return {
    symbol,
    definition,
    usages,
    usagesCount: totalUsagesCount,
    truncated
  };
}
