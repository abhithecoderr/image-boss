import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const projectRoot = path.resolve(__dirname, '..');

export function resolveImportPath(importSource, importingFilePath) {
  let base;
  if (importSource.startsWith('@/')) {
    base = path.resolve(projectRoot, 'src/client', importSource.slice(2));
  } else if (importSource.startsWith('.')) {
    const dir = path.dirname(importingFilePath);
    base = path.resolve(dir, importSource);
  } else {
    return null;
  }

  const candidates = [
    base,
    base + '.js',
    base + '.jsx',
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch (e) {}
  }
  return null;
}

export function findUsedBy(targetPath) {
  const targetAbs = path.resolve(targetPath);
  const srcDir = path.join(projectRoot, 'src');
  const usedBy = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach(f => {
      const fullPath = path.join(dir, f);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        return;
      }
      
      if (stat.isDirectory()) {
        if (f !== 'node_modules' && f !== 'dist' && !f.startsWith('.')) {
          walk(fullPath);
        }
      } else if (f.endsWith('.js') || f.endsWith('.jsx')) {
        try {
          const code = fs.readFileSync(fullPath, 'utf-8');
          const targetBase = path.basename(targetAbs, path.extname(targetAbs));
          if (code.includes(targetBase)) {
            const ast = parse(code, {
              sourceType: 'module',
              plugins: ['jsx']
            });
            let importsTarget = false;
            traverse(ast, {
              ImportDeclaration(pathNode) {
                const source = pathNode.node.source.value;
                const resolved = resolveImportPath(source, fullPath);
                if (resolved && path.resolve(resolved).toLowerCase() === targetAbs.toLowerCase()) {
                  importsTarget = true;
                }
              }
            });
            if (importsTarget) {
              usedBy.push(path.relative(projectRoot, fullPath).replace(/\\/g, '/'));
            }
          }
        } catch (e) {}
      }
    });
  }

  walk(srcDir);
  return usedBy;
}

export function findCallExpressions(node, calls = []) {
  if (!node) return calls;
  if (node.type === 'CallExpression') {
    calls.push(node);
  }
  for (const key in node) {
    if (node[key] && typeof node[key] === 'object') {
      if (Array.isArray(node[key])) {
        node[key].forEach(child => findCallExpressions(child, calls));
      } else if (node[key].type) {
        findCallExpressions(node[key], calls);
      }
    }
  }
  return calls;
}

export function extractJSXTextContent(node) {
  let text = '';
  if (!node || !node.children) return text;
  
  node.children.forEach(child => {
    if (child.type === 'JSXText') {
      text += child.value + ' ';
    } else if (child.type === 'JSXExpressionContainer') {
      const expr = child.expression;
      if (expr.type === 'StringLiteral') {
        text += expr.value + ' ';
      } else if (expr.type === 'ConditionalExpression') {
        if (expr.consequent.type === 'StringLiteral') {
          text += expr.consequent.value + ' ';
        }
        if (expr.alternate.type === 'StringLiteral') {
          text += expr.alternate.value + ' ';
        }
      }
    } else if (child.type === 'JSXElement') {
      text += extractJSXTextContent(child) + ' ';
    }
  });
  return text.trim();
}

export function getFunctionSignature(name, node) {
  if (!node) return null;
  let isFunc = node.type === 'ArrowFunctionExpression' || node.type === 'FunctionDeclaration';
  if (!isFunc) return null;

  let params = [];
  if (node.params && node.params.length > 0) {
    params = node.params.map(param => {
      if (param.type === 'ObjectPattern') {
        return '{ ' + param.properties.map(p => p.key ? p.key.name : '...').join(', ') + ' }';
      } else if (param.type === 'Identifier') {
        return param.name;
      } else if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
        return `${param.left.name}?`;
      } else if (param.type === 'RestElement' && param.argument.type === 'Identifier') {
        return `...${param.argument.name}`;
      }
      return '...';
    });
  }
  return `${name}(${params.join(', ')})`;
}
