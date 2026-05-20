import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'path';

function stripModuleAttributesPlugin(): import('vite').Plugin {
  return {
    name: 'strip-module-attributes',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type === 'asset' && item.fileName.endsWith('.html') && typeof item.source === 'string') {
          item.source = item.source
            .replaceAll(/\stype="module"/giu, '')
            .replaceAll(/\scrossorigin(?:=(?:anonymous|use-credentials|"[^"]*"))?/giu, '');
        }
      }
    },
  };
}

export default defineConfig({
  root: path.resolve(__dirname, 'src/ui/webview/react'),
  base: './',
  plugins: [react(), tailwind(), stripModuleAttributesPlugin()],
  build: {
    outDir: path.resolve(__dirname, 'src/ui/webview/dist/react'),
    emptyOutDir: true,
    // Evita <link rel="modulepreload"> y atributos crossorigin que rompen webviews VS Code.
    modulePreload: false,
    target: 'es2022',
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/ui/webview/react/index.html'),
      output: {
        // IIFE + entrada única → Vite 8 usa codeSplitting: false (un solo JS para el webview).
        // No usar inlineDynamicImports (deprecado; genera WARN si codeSplitting ya es false).
        format: 'iife',
        name: 'GhostPromptWebview',
        entryFileNames: 'assets/[name].js',
      },
    },
  },
});
