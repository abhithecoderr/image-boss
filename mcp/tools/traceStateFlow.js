import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { projectRoot } from '../utils.js';

const traverse = _traverse.default || _traverse;

export default function traceStateFlow(storeName, stateKey) {
  if (!stateKey) {
    throw new Error("stateKey is required for trace_state_flow");
  }

  const srcDir = path.join(projectRoot, 'src');
  const files = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const list = fs.readdirSync(dir);
    for (const f of list) {
      const fullPath = path.join(dir, f);
      let stat;
      try { stat = fs.statSync(fullPath); } catch (e) { continue; }
      if (stat.isDirectory()) {
        if (f !== 'node_modules' && f !== 'dist' && !f.startsWith('.')) {
          walk(fullPath);
        }
      } else if (f.endsWith('.js') || f.endsWith('.jsx')) {
        files.push(fullPath);
      }
    }
  }
  walk(srcDir);

  const updates = [];
  const subscriptions = [];

  const stateKeyRegex = new RegExp(`\\b${stateKey}\\b`);

  for (const filePath of files) {
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      if (!stateKeyRegex.test(code)) continue;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
      });

      const lines = code.split(/\r?\n/);

      traverse(ast, {
        CallExpression(pathNode) {
          const callee = pathNode.node.callee;
          if (callee.type === 'Identifier' && callee.name === 'set') {
            const firstArg = pathNode.node.arguments[0];
            let hasKeyUpdate = false;
            
            if (firstArg) {
              if (firstArg.type === 'ObjectExpression') {
                hasKeyUpdate = firstArg.properties.some(p => p.key && p.key.name === stateKey);
              } else if (firstArg.type === 'ArrowFunctionExpression' || firstArg.type === 'FunctionExpression') {
                let body = firstArg.body;
                if (body.type === 'ObjectExpression') {
                  hasKeyUpdate = body.properties.some(p => p.key && p.key.name === stateKey);
                } else {
                  traverse(body, {
                    ObjectExpression(objPath) {
                      if (objPath.parent.type === 'ReturnStatement' || objPath.parent.type === 'ArrowFunctionExpression') {
                        if (objPath.node.properties.some(p => p.key && p.key.name === stateKey)) {
                          hasKeyUpdate = true;
                        }
                      }
                    }
                  }, pathNode.scope);
                }
              }
            }

            if (hasKeyUpdate) {
              const line = pathNode.node.loc ? pathNode.node.loc.start.line : 0;
              updates.push({
                file: relativePath,
                line,
                code: lines[line - 1] ? lines[line - 1].trim() : ''
              });
            }
          }
        },

        VariableDeclarator(pathNode) {
          const init = pathNode.node.init;
          if (init && init.type === 'CallExpression') {
            const callee = init.callee;
            const isStoreHook = callee.type === 'Identifier' && /^use[A-Z]/.test(callee.name);
            if (isStoreHook) {
              let isSubscribed = false;
              const id = pathNode.node.id;

              if (id.type === 'ObjectPattern') {
                isSubscribed = id.properties.some(p => p.key && p.key.name === stateKey);
              }

              const firstArg = init.arguments[0];
              if (firstArg && (firstArg.type === 'ArrowFunctionExpression' || firstArg.type === 'FunctionExpression')) {
                const body = firstArg.body;
                if (body.type === 'MemberExpression') {
                  if (body.property && body.property.name === stateKey) {
                    isSubscribed = true;
                  }
                }
              }

              if (isSubscribed) {
                const line = pathNode.node.loc ? pathNode.node.loc.start.line : 0;
                subscriptions.push({
                  file: relativePath,
                  line,
                  code: lines[line - 1] ? lines[line - 1].trim() : '',
                  hook: callee.name
                });
              }
            }
          }
        }
      });
    } catch (e) {}
  }

  return {
    stateKey,
    storeName: storeName || 'any',
    updates,
    subscriptions
  };
}
