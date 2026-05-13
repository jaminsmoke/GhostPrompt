import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "src/ui/webview/react"),
  base: "./",
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, "src/ui/webview/dist/react"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "src/ui/webview/react/index.html"),
    },
  },
});
