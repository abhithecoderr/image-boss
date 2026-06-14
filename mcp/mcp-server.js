import readline from "readline";
import getFileConnections from "./tools/getFileConnections.js";
import getSymbolUsages from "./tools/getSymbolUsages.js";
import findUnusedCode from "./tools/findUnusedCode.js";
import findUnusedCss from "./tools/findUnusedCss.js";
import traceUiEvent from "./tools/traceUiEvent.js";
import traceStateFlow from "./tools/traceStateFlow.js";
import resolveRouteComponent from "./tools/resolveRouteComponent.js";
import getComponentSignature from "./tools/getComponentSignature.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", (line) => {
  if (!line.trim()) return;
  try {
    const request = JSON.parse(line);
    handleRequest(request);
  } catch (err) {
    sendError(null, -32700, "Parse error: " + err.message);
  }
});

function sendResponse(id, result) {
  const response = {
    jsonrpc: "2.0",
    id,
    result,
  };
  process.stdout.write(JSON.stringify(response) + "\n");
}

function sendError(id, code, message, data) {
  const response = {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data ? { data } : {}),
    },
  };
  process.stdout.write(JSON.stringify(response) + "\n");
}

function handleRequest(req) {
  const { method, id, params } = req;
  
  if (method === 'initialize') {
    sendResponse(id, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: "codebase-architecture-analyzer",
        version: "1.0.0"
      }
    });
    return;
  }
  
  if (method === 'notifications/initialized' || method === 'initialized') {
    return;
  }
  
  if (method === 'tools/list') {
    sendResponse(id, {
      tools: [
        {
          name: "get_file_connections",
          description: "Statically parses a JS/JSX file and extracts all imports (with specifiers), exports (with signatures) and files importing it ('usedBy').",
          inputSchema: {
            type: "object",
            properties: {
              filePath: {
                type: "string",
                description: "The absolute path to the Javascript (.js, .jsx) file."
              }
            },
            required: ["filePath"]
          }
        },
        {
          name: "get_symbol_usages",
          description: "Searches the codebase for all occurrences of a symbol (function, variable, component, class), identifying where it is defined vs where it is used, with surrounding context lines.",
          inputSchema: {
            type: "object",
            properties: {
              symbol: {
                type: "string",
                description: "The exact name of the symbol (e.g. 'selectService')."
              },
              contextLines: {
                type: "number",
                description: "Number of lines of context to include before and after the matching line (default: 5)."
              }
            },
            required: ["symbol"]
          }
        },
        {
          name: "find_unused_code",
          description: "Scans the codebase to find exported functions, classes, components, or variables that are never imported/used by other files.",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "find_unused_css",
          description: "Scans CSS files under src/ and checks if any defined CSS class selectors are never referenced/used in JS/JSX/HTML files.",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "trace_ui_event",
          description: "Traces a UI element to its event handler and execution call graph. Must specify at least one of elementText or elementType.",
          inputSchema: {
            type: "object",
            properties: {
              elementText: {
                type: "string",
                description: "The visual text or label/title/placeholder attribute of the JSX element (e.g. 'Process Image', 'Reset')."
              },
              elementType: {
                type: "string",
                description: "The tag/component name of the JSX element (e.g. 'Button', 'Select', 'a')."
              },
              eventType: {
                type: "string",
                description: "Standard JSX event type to trace (e.g. 'click', 'change')."
              }
            },
            required: []
          }
        },
        {
          name: "trace_state_flow",
          description: "Traces updates and subscriptions/reads of a global Zustand store state key across components and hooks.",
          inputSchema: {
            type: "object",
            properties: {
              stateKey: {
                type: "string",
                description: "The exact state key name to trace (e.g. 'isProcessing')."
              },
              storeName: {
                type: "string",
                description: "Optional name of the store (e.g. 'workspaceStore')."
              }
            },
            required: ["stateKey"]
          }
        },
        {
          name: "resolve_route_component",
          description: "Statically analyzes React Router configuration in App.jsx to map a dynamic URL path segment to its component rendering hierarchy.",
          inputSchema: {
            type: "object",
            properties: {
              urlPath: {
                type: "string",
                description: "The dynamic client-side URL path segment to resolve (e.g. '/services/magic-erase')."
              }
            },
            required: ["urlPath"]
          }
        },
        {
          name: "get_component_signature",
          description: "Extracts custom React component prop definitions and maps all instantiations with passed properties.",
          inputSchema: {
            type: "object",
            properties: {
              componentName: {
                type: "string",
                description: "The tag/component name of the custom element (e.g. 'Button', 'Select')."
              }
            },
            required: ["componentName"]
          }
        }
      ]
    });
    return;
  }
  
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    if (name === 'get_file_connections') {
      const { filePath } = args;
      try {
        const result = getFileConnections(filePath);
        sendResponse(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        });
      } catch (err) {
        sendResponse(id, {
          content: [{ type: "text", text: `Error analyzing file: ${err.message}` }],
          isError: true
        });
      }
    } else if (name === 'get_symbol_usages') {
      const { symbol, contextLines } = args;
      try {
        const result = getSymbolUsages(symbol, contextLines !== undefined ? contextLines : 5);
        sendResponse(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        });
      } catch (err) {
        sendResponse(id, {
          content: [{ type: "text", text: `Error scanning symbol usages: ${err.message}` }],
          isError: true
        });
      }
    } else if (name === 'find_unused_code') {
      try {
        const result = findUnusedCode();
        sendResponse(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        });
      } catch (err) {
        sendResponse(id, {
          content: [{ type: "text", text: `Error finding unused code: ${err.message}` }],
          isError: true
        });
      }
    } else if (name === 'find_unused_css') {
      try {
        const result = findUnusedCss();
        sendResponse(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        });
      } catch (err) {
        sendResponse(id, {
          content: [{ type: "text", text: `Error finding unused CSS: ${err.message}` }],
          isError: true
        });
      }
    } else if (name === 'trace_ui_event') {
      const { elementText, elementType, eventType } = args;
      try {
        const result = traceUiEvent(elementText, elementType, eventType);
        sendResponse(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        });
      } catch (err) {
        sendResponse(id, {
          content: [{ type: "text", text: `Error tracing UI event: ${err.message}` }],
          isError: true
        });
      }
    } else if (name === 'trace_state_flow') {
      const { storeName, stateKey } = args;
      try {
        const result = traceStateFlow(storeName, stateKey);
        sendResponse(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        });
      } catch (err) {
        sendResponse(id, {
          content: [{ type: "text", text: `Error tracing state flow: ${err.message}` }],
          isError: true
        });
      }
    } else if (name === 'resolve_route_component') {
      const { urlPath } = args;
      try {
        const result = resolveRouteComponent(urlPath);
        sendResponse(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        });
      } catch (err) {
        sendResponse(id, {
          content: [{ type: "text", text: `Error resolving route: ${err.message}` }],
          isError: true
        });
      }
    } else if (name === 'get_component_signature') {
      const { componentName } = args;
      try {
        const result = getComponentSignature(componentName);
        sendResponse(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        });
      } catch (err) {
        sendResponse(id, {
          content: [{ type: "text", text: `Error getting component signature: ${err.message}` }],
          isError: true
        });
      }
    } else {
      sendError(id, -32601, `Method not found: tool ${name}`);
    }
    return;
  }
  
  if (id !== undefined) {
    sendError(id, -32601, `Method not found: ${method}`);
  }
}
