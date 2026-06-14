import { spawn } from 'child_process';
import path from 'path';

/**
 * Custom Vite plugin that triggers an AST-compressed repomix extraction
 * whenever a source file is modified.
 */
export default function aiContextWatcher() {
  let debounceTimer;

  return {
    name: 'vite-plugin-ai-context',
    
    // Hook into Vite's HMR file change event
    handleHotUpdate({ file, server }) {
      const relativePath = path.relative(process.cwd(), file).replace(/\\/g, '/');
      const isSrc = (relativePath.startsWith('src/') && (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.css') || file.endsWith('.html'))) || relativePath === 'index.html';
      const isPackageJson = file.endsWith('package.json');
      
      if (isSrc || isPackageJson) {
        
        // Debounce by 2 seconds to avoid spamming the generator
        // if multiple files are saved simultaneously
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          server.config.logger.info('\n[AI-Context] Source file changed. Regenerating context maps...', { timestamp: true });
          
          // Spawn custom context generator process in the background
          const parserProcess = spawn(
            process.platform === 'win32' ? 'node.exe' : 'node',
            ['scripts/generate-context.js'],
            { cwd: process.cwd(), stdio: 'ignore', detached: true }
          );
          parserProcess.unref(); // Detach process so it doesn't block Vite

          // Spawn custom CSS context generator process in the background
          const cssParserProcess = spawn(
            process.platform === 'win32' ? 'node.exe' : 'node',
            ['scripts/generate-context-css.js'],
            { cwd: process.cwd(), stdio: 'ignore', detached: true }
          );
          cssParserProcess.unref(); // Detach process so it doesn't block Vite
        }, 2000);
      }
    }
  };
}
