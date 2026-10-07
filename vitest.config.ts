import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Config de teste isolada do vite.config.ts (que envolve o wrapper
// @lovable.dev/vite-tanstack-config, não pensado para rodar sob Vitest).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    css: false,
    setupFiles: ["./vitest.setup.ts"],
    // Com várias sessões abertas na máquina, o padrão (um worker por núcleo)
    // estourava "Failed to start forks worker" e pulava arquivos (HIG-20).
    // Com 2 workers os 1000+ testes passam sempre, em ~2 min.
    maxWorkers: 2,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts", "src/hooks/**/*.{ts,tsx}"],
    },
  },
});
