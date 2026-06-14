import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { projectRoot } from '../utils.js';

const traverse = _traverse.default || _traverse;

export default function getComponentSignature(componentName) {
  if (!componentName) {
    throw new Error("componentName is required for get_component_signature");
  }

  const srcDir = path.join(projectRoot, 'src');
  const jsxFiles = [];

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
      } else if (f.endsWith('.jsx')) {
        jsxFiles.push(fullPath);
      }
    }
  }
  walk(srcDir);

  let definition = null;
  const instantiations = [];

  function extractPropsFromParams(funcNode, file) {
    const props = [];
    const firstParam = funcNode.params[0];
    if (firstParam) {
      if (firstParam.type === 'ObjectPattern') {
        firstParam.properties.forEach(prop => {
          if (prop.type === 'ObjectProperty' && prop.key) {
            let name = prop.key.name || '';
            let defaultValue = undefined;
            if (prop.value && prop.value.type === 'AssignmentPattern') {
              const left = prop.value.left;
              name = left.name;
              const right = prop.value.right;
              if (right.type === 'StringLiteral') {
                defaultValue = right.value;
              } else if (right.type === 'BooleanLiteral' || right.type === 'NumericLiteral') {
                defaultValue = right.value;
              } else if (right.type === 'Identifier') {
                defaultValue = right.name;
              } else {
                defaultValue = 'expression';
              }
            }
            props.push({ name, defaultValue });
          }
        });
      } else if (firstParam.type === 'Identifier') {
        props.push({ name: firstParam.name, isObject: false });
      }
    }
    return {
      component: componentName,
      file,
      line: funcNode.loc ? funcNode.loc.start.line : 0,
      props
    };
  }

  for (const filePath of jsxFiles) {
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      if (!code.includes(componentName)) continue;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
      });

      traverse(ast, {
        FunctionDeclaration(pathNode) {
          if (pathNode.node.id && pathNode.node.id.name === componentName) {
            definition = extractPropsFromParams(pathNode.node, relativePath);
          }
        },
        VariableDeclarator(pathNode) {
          if (pathNode.node.id.type === 'Identifier' && pathNode.node.id.name === componentName) {
            if (pathNode.node.init && (pathNode.node.init.type === 'ArrowFunctionExpression' || pathNode.node.init.type === 'FunctionExpression')) {
              definition = extractPropsFromParams(pathNode.node.init, relativePath);
            }
          }
        }
      });

      if (definition) break;
    } catch (e) {}
  }

  const componentTagRegex = new RegExp(`<${componentName}\\b`);
  
  for (const filePath of jsxFiles) {
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      if (!componentTagRegex.test(code)) continue;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
      });

      const lines = code.split(/\r?\n/);

      traverse(ast, {
        JSXOpeningElement(pathNode) {
          const nameNode = pathNode.node.name;
          if (nameNode.type === 'JSXIdentifier' && nameNode.name === componentName) {
            const line = pathNode.node.loc ? pathNode.node.loc.start.line : 0;
            const propsPassed = {};
            
            pathNode.node.attributes.forEach(attr => {
              if (attr.type === 'JSXAttribute' && attr.name) {
                const attrName = attr.name.name;
                let attrValue = true;
                if (attr.value) {
                  if (attr.value.type === 'StringLiteral') {
                    attrValue = attr.value.value;
                  } else if (attr.value.type === 'JSXExpressionContainer') {
                    const expr = attr.value.expression;
                    if (expr.type === 'StringLiteral' || expr.type === 'NumericLiteral' || expr.type === 'BooleanLiteral') {
                      attrValue = expr.value;
                    } else if (expr.type === 'Identifier') {
                      attrValue = `{${expr.name}}`;
                    } else {
                      attrValue = '{expression}';
                    }
                  }
                }
                propsPassed[attrName] = attrValue;
              }
            });

            instantiations.push({
              file: relativePath,
              line,
              props: propsPassed,
              code: lines[line - 1] ? lines[line - 1].trim() : ''
            });
          }
        }
      });
    } catch (e) {}
  }

  return {
    componentName,
    definition,
    instantiations,
    instantiationsCount: instantiations.length
  };
}
