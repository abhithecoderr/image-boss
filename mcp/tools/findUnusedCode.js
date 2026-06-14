import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { resolveImportPath, projectRoot } from '../utils.js';

const traverse = _traverse.default || _traverse;

export default function findUnusedCode() {
  const srcDir = path.join(projectRoot, 'src');
  const allFiles = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const fullPath = path.join(dir, f);
      let stat;
      try { stat = fs.statSync(fullPath); } catch (e) { continue; }
      if (stat.isDirectory()) {
        if (f !== 'node_modules' && f !== 'dist' && !f.startsWith('.')) {
          walk(fullPath);
        }
      } else if (f.endsWith('.js') || f.endsWith('.jsx')) {
        allFiles.push(fullPath);
      }
    }
  }
  walk(srcDir);

  const fileExports = new Map();
  const importsSet = new Set();
  const importedFiles = new Set();

  for (const filePath of allFiles) {
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
      });

      const fileExportsList = [];

      traverse(ast, {
        ImportDeclaration(pathNode) {
          const source = pathNode.node.source.value;
          const resolved = resolveImportPath(source, filePath);
          if (resolved) {
            const resolvedRel = path.relative(projectRoot, resolved).replace(/\\/g, '/');
            importedFiles.add(resolvedRel);
            
            if (pathNode.node.specifiers.length === 0) {
              importsSet.add(`${resolvedRel}:*`);
            } else {
              pathNode.node.specifiers.forEach(spec => {
                if (spec.type === 'ImportDefaultSpecifier') {
                  importsSet.add(`${resolvedRel}:default`);
                } else if (spec.type === 'ImportNamespaceSpecifier') {
                  importsSet.add(`${resolvedRel}:*`);
                } else if (spec.type === 'ImportSpecifier') {
                  const exportedName = spec.imported.name;
                  importsSet.add(`${resolvedRel}:${exportedName}`);
                }
              });
            }
          }
        },
        ExportNamedDeclaration(pathNode) {
          if (pathNode.node.declaration) {
            const decl = pathNode.node.declaration;
            if (decl.type === 'VariableDeclaration') {
              decl.declarations.forEach(d => {
                if (d.id.type === 'Identifier') {
                  fileExportsList.push({
                    name: d.id.name,
                    type: 'named',
                    line: d.loc ? d.loc.start.line : 0
                  });
                }
              });
            } else if (decl.type === 'FunctionDeclaration' && decl.id) {
              fileExportsList.push({
                name: decl.id.name,
                type: 'named',
                line: decl.loc ? decl.loc.start.line : 0
              });
            } else if (decl.type === 'ClassDeclaration' && decl.id) {
              fileExportsList.push({
                name: decl.id.name,
                type: 'named',
                line: decl.loc ? decl.loc.start.line : 0
              });
            }
          }
          if (pathNode.node.specifiers) {
            pathNode.node.specifiers.forEach(spec => {
              fileExportsList.push({
                name: spec.exported.name,
                type: 'named',
                line: spec.loc ? spec.loc.start.line : 0
              });
            });
          }
        },
        ExportDefaultDeclaration(pathNode) {
          const decl = pathNode.node.declaration;
          let name = 'default';
          if (decl.type === 'FunctionDeclaration' && decl.id) {
            name = decl.id.name;
          } else if (decl.type === 'ClassDeclaration' && decl.id) {
            name = decl.id.name;
          } else if (decl.type === 'Identifier') {
            name = decl.name;
          }
          fileExportsList.push({
            name: 'default',
            exportedAs: name,
            type: 'default',
            line: pathNode.node.loc ? pathNode.node.loc.start.line : 0
          });
        },
        ExportAllDeclaration(pathNode) {
          const source = pathNode.node.source.value;
          const resolved = resolveImportPath(source, filePath);
          if (resolved) {
            const resolvedRel = path.relative(projectRoot, resolved).replace(/\\/g, '/');
            importsSet.add(`${resolvedRel}:*`);
          }
        }
      });

      if (fileExportsList.length > 0) {
        fileExports.set(relativePath, fileExportsList);
      }
    } catch (e) {
      // Ignore parsing errors for individual files
    }
  }

  const deadExports = [];
  const EXCLUDED_FILENAMES = new Set([
    'main.jsx', 'main.js',
    'index.jsx', 'index.js',
    'App.jsx', 'App.js',
    'vite.config.js',
    'worker.js', 'service-worker.js'
  ]);

  for (const [file, exportsList] of fileExports.entries()) {
    const baseName = path.basename(file);
    if (EXCLUDED_FILENAMES.has(baseName)) {
      continue;
    }

    const fileDead = [];
    exportsList.forEach(exp => {
      const key = `${file}:${exp.name}`;
      const isWildcardImported = importsSet.has(`${file}:*`);
      const isDirectlyImported = importsSet.has(key);
      const isUsed = isDirectlyImported || isWildcardImported;

      if (!isUsed) {
        fileDead.push({
          name: exp.name === 'default' && exp.exportedAs ? `default (${exp.exportedAs})` : exp.name,
          line: exp.line
        });
      }
    });

    if (fileDead.length > 0) {
      deadExports.push({
        file,
        unusedExports: fileDead
      });
    }
  }

  return deadExports;
}
