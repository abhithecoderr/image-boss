import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { resolveImportPath, findUsedBy, getFunctionSignature, projectRoot } from '../utils.js';

const traverse = _traverse.default || _traverse;

export default function getFileConnections(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  const code = fs.readFileSync(resolvedPath, 'utf-8');
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });

  const imports = [];
  const exports = [];

  traverse(ast, {
    ImportDeclaration(pathNode) {
      const source = pathNode.node.source.value;
      const specifiers = pathNode.node.specifiers.map(s => {
        if (s.type === 'ImportDefaultSpecifier') return s.local.name;
        if (s.type === 'ImportSpecifier') return s.imported.name === s.local.name ? s.local.name : `${s.imported.name} as ${s.local.name}`;
        return s.local.name;
      }).join(', ');
      
      imports.push({
        source,
        specifiers: specifiers ? specifiers.split(', ') : []
      });
    },
    ExportNamedDeclaration(pathNode) {
      if (pathNode.node.declaration) {
        if (pathNode.node.declaration.type === 'VariableDeclaration') {
          pathNode.node.declaration.declarations.forEach(decl => {
            if (decl.id.type === 'Identifier') {
              const sig = getFunctionSignature(decl.id.name, decl.init);
              exports.push({
                type: "named",
                name: decl.id.name,
                signature: sig || decl.id.name
              });
            }
          });
        } else if (pathNode.node.declaration.type === 'FunctionDeclaration') {
           const name = pathNode.node.declaration.id.name;
           const sig = getFunctionSignature(name, pathNode.node.declaration);
           exports.push({
             type: "named",
             name,
             signature: sig || name
           });
        }
      }
      if (pathNode.node.specifiers && pathNode.node.specifiers.length > 0) {
        pathNode.node.specifiers.forEach(spec => {
          exports.push({
            type: "named",
            name: spec.local.name,
            signature: spec.exported.name !== spec.local.name ? `${spec.local.name} as ${spec.exported.name}` : spec.local.name
          });
        });
      }
    },
    ExportDefaultDeclaration(pathNode) {
      const decl = pathNode.node.declaration;
      let name = "default";
      if (decl.type === 'FunctionDeclaration' && decl.id) {
        name = decl.id.name;
      } else if (decl.type === 'Identifier') {
        name = decl.name;
      }
      const sig = getFunctionSignature(name, decl);
      exports.push({
        type: "default",
        name,
        signature: sig || name
      });
    }
  });

  const usedBy = findUsedBy(resolvedPath);

  return {
    file: path.basename(resolvedPath),
    filePath: path.relative(projectRoot, resolvedPath).replace(/\\/g, '/'),
    imports,
    exports,
    usedBy
  };
}
