import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import {
  projectRoot,
  resolveImportPath,
  findCallExpressions,
  extractJSXTextContent,
  getFunctionSignature
} from '../utils.js';

const traverse = _traverse.default || _traverse;

export default function traceUiEvent(elementText, elementType, eventType) {
  if (!elementText && !elementType) {
    throw new Error("Either elementText or elementType must be provided to trace a UI event.");
  }

  const srcDir = path.join(projectRoot, 'src');
  const jsxFiles = [];

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
      } else if (f.endsWith('.jsx')) {
        jsxFiles.push(fullPath);
      }
    }
  }
  walk(srcDir);

  const matchedElements = [];

  for (const filePath of jsxFiles) {
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
      });

      traverse(ast, {
        JSXElement(pathNode) {
          let tagName = '';
          const tagNode = pathNode.node.openingElement.name;
          if (tagNode.type === 'JSXIdentifier') {
            tagName = tagNode.name;
          } else if (tagNode.type === 'JSXMemberExpression') {
            let current = tagNode;
            const parts = [];
            while (current) {
              if (current.type === 'JSXIdentifier') {
                parts.unshift(current.name);
                current = null;
              } else if (current.type === 'JSXMemberExpression') {
                parts.unshift(current.property.name);
                current = current.object;
              } else {
                current = null;
              }
            }
            tagName = parts.join('.');
          }

          const hasTypeMatch = elementType
            ? tagName.toLowerCase().includes(elementType.toLowerCase())
            : true;

          if (!hasTypeMatch) return;

          const textVal = extractJSXTextContent(pathNode.node);
          const hasTextMatch = elementText
            ? textVal.toLowerCase().includes(elementText.toLowerCase())
            : false;

          let hasAttrMatch = false;
          let matchedAttrVal = '';
          if (pathNode.node.openingElement && pathNode.node.openingElement.attributes) {
            pathNode.node.openingElement.attributes.forEach(attr => {
              if (attr.type === 'JSXAttribute' && attr.value) {
                const name = attr.name.name;
                if (['label', 'title', 'placeholder', 'value', 'aria-label'].includes(name)) {
                  if (attr.value.type === 'StringLiteral') {
                    const val = attr.value.value.trim().toLowerCase();
                    if (elementText && val.includes(elementText.toLowerCase())) {
                      hasAttrMatch = true;
                      matchedAttrVal = attr.value.value;
                    }
                  }
                }
              }
            });
          }

          const passesTextSearch = elementText
            ? (hasTextMatch || hasAttrMatch)
            : true;

          if (!passesTextSearch) return;

          const line = pathNode.node.openingElement.loc ? pathNode.node.openingElement.loc.start.line : 0;
          
          const handlers = [];
          let hasEventMatch = false;
          
          if (pathNode.node.openingElement && pathNode.node.openingElement.attributes) {
            pathNode.node.openingElement.attributes.forEach(attr => {
              if (attr.type === 'JSXAttribute' && attr.name) {
                const attrName = attr.name.name;
                if (/^on[A-Z]/.test(attrName) || ['to', 'href'].includes(attrName)) {
                  handlers.push({
                    name: attrName,
                    value: attr.value
                  });

                  if (eventType) {
                    const normalizedEvent = eventType.toLowerCase();
                    if (normalizedEvent === 'click' && (attrName.toLowerCase() === 'onclick' || attrName === 'to' || attrName === 'href')) {
                      hasEventMatch = true;
                    } else if (normalizedEvent === 'change' && attrName.toLowerCase() === 'onchange') {
                      hasEventMatch = true;
                    } else if (attrName.toLowerCase() === `on${normalizedEvent}`) {
                      hasEventMatch = true;
                    }
                  }
                }
              }
            });
          }

          const passesEventSearch = eventType ? hasEventMatch : true;
          if (!passesEventSearch) return;

          matchedElements.push({
            filePath,
            relativePath,
            tag: tagName,
            line,
            text: textVal || matchedAttrVal || '',
            handlers
          });
        }
      });
    } catch (e) {
      // Ignore syntax/read errors in individual files
    }
  }

  const queryLabel = [
    elementText ? `text "${elementText}"` : null,
    elementType ? `type "${elementType}"` : null,
    eventType ? `event "${eventType}"` : null
  ].filter(Boolean).join(', ');

  if (matchedElements.length === 0) {
    return {
      message: `No JSX elements matching (${queryLabel}) were found in the src/ directory.`
    };
  }

  const astCache = new Map();
  function getFileAST(file) {
    if (astCache.has(file)) return astCache.get(file);
    try {
      if (!fs.existsSync(file)) return null;
      const code = fs.readFileSync(file, 'utf-8');
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
      });
      astCache.set(file, ast);
      return ast;
    } catch (e) {
      return null;
    }
  }

  const BUILTINS = new Set([
    'console', 'log', 'error', 'warn', 'info',
    'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every', 'push', 'pop', 'shift', 'unshift',
    'then', 'catch', 'finally',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite',
    'Object', 'Array', 'String', 'Number', 'Boolean', 'Promise', 'JSON'
  ]);

  const visited = new Set();

  function traceFunctionCall(file, funcName, depth) {
    if (depth > 3) return null;
    
    if (funcName.includes('.')) {
      const [objName, propName] = funcName.split('.');
      const ast = getFileAST(file);
      if (!ast) return null;
      
      let objDefinitionInfo = null;
      let objImportedFrom = null;

      traverse(ast, {
        ImportDeclaration(pathNode) {
          pathNode.node.specifiers.forEach(spec => {
            if (spec.local.name === objName) {
              objImportedFrom = resolveImportPath(pathNode.node.source.value, file);
            }
          });
        },
        VariableDeclarator(pathNode) {
          if (pathNode.node.id.type === 'Identifier' && pathNode.node.id.name === objName) {
            objDefinitionInfo = {
              node: pathNode.node,
              type: 'VariableDeclarator',
              line: pathNode.node.loc ? pathNode.node.loc.start.line : 0
            };
          }
        }
      });

      if (objImportedFrom) {
        const resolvedImport = traceFunctionCall(objImportedFrom, propName, depth + 1);
        if (resolvedImport) {
          return {
            name: funcName,
            file: path.relative(projectRoot, file).replace(/\\/g, '/'),
            type: 'ImportedMemberCall',
            calls: [resolvedImport]
          };
        }
      }

      if (objDefinitionInfo && objDefinitionInfo.node.init && objDefinitionInfo.node.init.type === 'CallExpression' && objDefinitionInfo.node.init.callee.type === 'Identifier') {
        const calleeHook = objDefinitionInfo.node.init.callee.name;
        const hookTrace = traceFunctionCall(file, calleeHook, depth);
        if (hookTrace && hookTrace.calls && hookTrace.calls.length > 0) {
          const hookFileTrace = hookTrace.calls[hookTrace.calls.length - 1];
          const hookFile = path.resolve(projectRoot, hookFileTrace.file);
          const propTrace = traceFunctionCall(hookFile, propName, depth + 1);
          if (propTrace) {
            return {
              name: funcName,
              file: path.relative(projectRoot, file).replace(/\\/g, '/'),
              line: objDefinitionInfo.line,
              type: `Member Call of ${propName} on ${objName}`,
              calls: [propTrace]
            };
          }
        }
      }

      return {
        name: funcName,
        file: path.relative(projectRoot, file).replace(/\\/g, '/'),
        type: 'MemberCall',
        calls: []
      };
    }

    const key = `${file}:${funcName}`;
    if (visited.has(key)) {
      return {
        name: funcName,
        file: path.relative(projectRoot, file).replace(/\\/g, '/'),
        cyclic: true
      };
    }
    visited.add(key);

    const ast = getFileAST(file);
    if (!ast) return null;

    let definitionInfo = null;
    let importedFrom = null;

    traverse(ast, {
      ImportDeclaration(pathNode) {
        pathNode.node.specifiers.forEach(spec => {
          if (spec.local.name === funcName) {
            importedFrom = resolveImportPath(pathNode.node.source.value, file);
          }
        });
      },
      FunctionDeclaration(pathNode) {
        if (pathNode.node.id && pathNode.node.id.name === funcName) {
          definitionInfo = {
            node: pathNode.node,
            type: 'FunctionDeclaration',
            line: pathNode.node.loc ? pathNode.node.loc.start.line : 0
          };
        }
      },
      VariableDeclarator(pathNode) {
        if (pathNode.node.id.type === 'Identifier' && pathNode.node.id.name === funcName) {
          definitionInfo = {
            node: pathNode.node,
            type: 'VariableDeclarator',
            line: pathNode.node.loc ? pathNode.node.loc.start.line : 0
          };
        } else if (pathNode.node.id.type === 'ObjectPattern') {
          const hasProp = pathNode.node.id.properties.some(p => p.key && p.key.name === funcName);
          if (hasProp) {
            if (pathNode.node.init && pathNode.node.init.type === 'CallExpression' && pathNode.node.init.callee.type === 'Identifier') {
              definitionInfo = {
                node: pathNode.node,
                type: `Destructured from ${pathNode.node.init.callee.name}()`,
                line: pathNode.node.loc ? pathNode.node.loc.start.line : 0
              };
            } else {
              definitionInfo = {
                node: pathNode.node,
                type: 'DestructuredObjectPattern',
                line: pathNode.node.loc ? pathNode.node.loc.start.line : 0
              };
            }
          }
        }
      }
    });

    const nodeTrace = {
      name: funcName,
      file: path.relative(projectRoot, file).replace(/\\/g, '/'),
      line: definitionInfo ? definitionInfo.line : 0,
      type: definitionInfo ? definitionInfo.type : 'unknown',
      calls: []
    };

    if (importedFrom) {
      const resolvedImport = traceFunctionCall(importedFrom, funcName, depth + 1);
      if (resolvedImport) {
        nodeTrace.type = 'Imported';
        nodeTrace.calls.push(resolvedImport);
      }
      return nodeTrace;
    }

    if (definitionInfo) {
      if (definitionInfo.type.startsWith('Destructured from')) {
        const hookName = definitionInfo.type.split('Destructured from ')[1].replace('()', '');
        const hookTrace = traceFunctionCall(file, hookName, depth);
        if (hookTrace && hookTrace.calls && hookTrace.calls.length > 0) {
          const hookFileTrace = hookTrace.calls[hookTrace.calls.length - 1];
          const hookFile = path.resolve(projectRoot, hookFileTrace.file);
          const propTrace = traceFunctionCall(hookFile, funcName, depth + 1);
          if (propTrace) {
            nodeTrace.calls.push(propTrace);
          }
        }
        return nodeTrace;
      }

      const calledFunctions = new Set();
      const calls = findCallExpressions(definitionInfo.node);
      calls.forEach(callNode => {
        const callee = callNode.callee;
        if (callee.type === 'Identifier') {
          const calleeName = callee.name;
          if (!BUILTINS.has(calleeName)) {
            calledFunctions.add(calleeName);
          }
        } else if (callee.type === 'MemberExpression') {
          if (callee.object.type === 'Identifier' && callee.property.type === 'Identifier') {
            const objName = callee.object.name;
            const propName = callee.property.name;
            if (!BUILTINS.has(objName)) {
              calledFunctions.add(`${objName}.${propName}`);
            }
          }
        }
      });

      for (const callee of calledFunctions) {
        const childTrace = traceFunctionCall(file, callee, depth + 1);
        if (childTrace) {
          nodeTrace.calls.push(childTrace);
        }
      }
    }

    return nodeTrace;
  }

  const results = [];

  for (const elem of matchedElements) {
    const handlersTraces = [];

    for (const handler of elem.handlers) {
      if (['to', 'href'].includes(handler.name)) {
        let dest = 'unknown';
        if (handler.value) {
          if (handler.value.type === 'StringLiteral') {
            dest = handler.value.value;
          } else if (handler.value.type === 'JSXExpressionContainer') {
            const expr = handler.value.expression;
            if (expr.type === 'StringLiteral') {
              dest = expr.value;
            } else if (expr.type === 'Identifier') {
              dest = `{${expr.name}}`;
            } else if (expr.type === 'MemberExpression') {
              dest = `{${expr.object.name}.${expr.property.name}}`;
            } else {
              dest = '{expression}';
            }
          }
        }
        handlersTraces.push({
          event: handler.name,
          traces: [
            {
              name: `Navigation to "${dest}"`,
              file: elem.relativePath,
              line: elem.line,
              type: 'NavigationRoute',
              calls: []
            }
          ]
        });
      } else if (handler.value && handler.value.type === 'JSXExpressionContainer') {
        const expr = handler.value.expression;
        const entrySymbols = [];

        if (expr.type === 'Identifier') {
          entrySymbols.push(expr.name);
        } else if (expr.type === 'MemberExpression') {
          if (expr.object.type === 'Identifier' && expr.property.type === 'Identifier') {
            entrySymbols.push(`${expr.object.name}.${expr.property.name}`);
          }
        } else if (expr.type === 'ArrowFunctionExpression' || expr.type === 'FunctionExpression') {
          const calls = findCallExpressions(expr);
          calls.forEach(callNode => {
            const callee = callNode.callee;
            if (callee.type === 'Identifier') {
              const name = callee.name;
              if (!BUILTINS.has(name)) {
                entrySymbols.push(name);
              }
            } else if (callee.type === 'MemberExpression') {
              if (callee.object.type === 'Identifier' && callee.property.type === 'Identifier') {
                const objName = callee.object.name;
                const propName = callee.property.name;
                if (!BUILTINS.has(objName)) {
                  entrySymbols.push(`${objName}.${propName}`);
                }
              }
            }
          });
        }

        const traces = [];
        for (const symbol of entrySymbols) {
          visited.clear();
          const tr = traceFunctionCall(elem.filePath, symbol, 1);
          if (tr) traces.push(tr);
        }

        handlersTraces.push({
          event: handler.name,
          traces
        });
      }
    }

    results.push({
      element: `<${elem.tag}>`,
      text: elem.text,
      file: elem.relativePath,
      line: elem.line,
      handlers: handlersTraces
    });
  }

  return results;
}
