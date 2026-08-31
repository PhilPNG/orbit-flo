/// <reference types="vitest/config" />

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/@supabase/") || id.includes("\\@supabase\\")) return "vendor-supabase";
          if (id.includes("/@tanstack/") || id.includes("\\@tanstack\\")) return "vendor-query";
          if (id.includes("/@xyflow/") || id.includes("\\@xyflow\\")) return "vendor-flow";
          if (id.includes("/react-router") || id.includes("\\react-router")) return "vendor-router";
          if (id.includes("/lucide-react/") || id.includes("\\lucide-react\\")) return "vendor-icons";
          if (id.includes("/react/") || id.includes("\\react\\") || id.includes("/react-dom/") || id.includes("\\react-dom\\")) {
            return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: "./src/test/setup.ts",
    // userEvent-heavy tests routinely exceed the 5s default on loaded machines.
    testTimeout: 15000,
  },
});
