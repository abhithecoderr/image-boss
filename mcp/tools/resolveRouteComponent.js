import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { projectRoot } from '../utils.js';

const traverse = _traverse.default || _traverse;

export default function resolveRouteComponent(urlPath) {
  if (!urlPath) {
    throw new Error("urlPath is required for resolve_route_component");
  }

  const normalizedPath = '/' + urlPath.replace(/^\/+|\/+$/g, '');

  const appFile = path.join(projectRoot, 'src/client/App.jsx');
  if (!fs.existsSync(appFile)) {
    throw new Error(`Router configuration file not found at ${appFile}`);
  }

  const code = fs.readFileSync(appFile, 'utf-8');
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });

  let routesArrayNode = null;

  traverse(ast, {
    CallExpression(pathNode) {
      const callee = pathNode.node.callee;
      if (callee.type === 'Identifier' && callee.name === 'createBrowserRouter') {
        routesArrayNode = pathNode.node.arguments[0];
      }
    }
  });

  if (!routesArrayNode || routesArrayNode.type !== 'ArrayExpression') {
    throw new Error("Could not find createBrowserRouter route array in App.jsx");
  }

  function parseRouteNode(node) {
    if (node.type !== 'ObjectExpression') return null;
    const route = {};
    node.properties.forEach(prop => {
      if (prop.type === 'ObjectProperty' && prop.key) {
        const name = prop.key.name || prop.key.value;
        if (name === 'path') {
          if (prop.value.type === 'StringLiteral') {
            route.path = prop.value.value;
          }
        } else if (name === 'element') {
          if (prop.value.type === 'JSXElement') {
            const opening = prop.value.openingElement;
            if (opening && opening.name) {
              route.element = opening.name.name;
            }
          }
        } else if (name === 'index') {
          if (prop.value.type === 'BooleanLiteral') {
            route.index = prop.value.value;
          }
        } else if (name === 'children') {
          if (prop.value.type === 'ArrayExpression') {
            route.children = prop.value.elements.map(parseRouteNode).filter(Boolean);
          }
        }
      }
    });
    return route;
  }

  const routes = routesArrayNode.elements.map(parseRouteNode).filter(Boolean);

  const targetSegments = normalizedPath.split('/').filter(Boolean);

  function matchRoute(routeList, segments, activeStack = []) {
    for (const route of routeList) {
      const routeStack = [...activeStack];
      if (route.element) {
        routeStack.push({
          path: route.path || (route.index ? '(index)' : ''),
          element: route.element
        });
      }

      const routePath = route.path || '';
      const routeSegments = routePath.split('/').filter(Boolean);

      let isMatch = true;
      let segmentsConsumed = 0;

      for (let i = 0; i < routeSegments.length; i++) {
        const rSeg = routeSegments[i];
        const tSeg = segments[i];

        if (rSeg.startsWith(':')) {
          if (!tSeg && !rSeg.endsWith('?')) {
            isMatch = false;
            break;
          }
          segmentsConsumed++;
        } else {
          if (rSeg !== tSeg) {
            isMatch = false;
            break;
          }
          segmentsConsumed++;
        }
      }

      if (isMatch) {
        const remainingSegments = segments.slice(segmentsConsumed);
        if (remainingSegments.length === 0) {
          if (route.children) {
            const indexChild = route.children.find(c => c.index);
            if (indexChild && indexChild.element) {
              routeStack.push({
                path: indexChild.path || '(index)',
                element: indexChild.element
              });
            }
          }
          return routeStack;
        }

        if (route.children) {
          const childMatch = matchRoute(route.children, remainingSegments, routeStack);
          if (childMatch) return childMatch;
        }
      }
    }
    return null;
  }

  const matchStack = matchRoute(routes, targetSegments);

  if (!matchStack) {
    return {
      path: urlPath,
      matched: false,
      message: `No matching route component found for path "${urlPath}"`
    };
  }

  return {
    path: urlPath,
    matched: true,
    hierarchy: matchStack,
    renderedComponent: matchStack[matchStack.length - 1].element
  };
}
