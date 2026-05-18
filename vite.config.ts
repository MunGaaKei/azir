import react from "@vitejs/plugin-react";
/// <reference types="@batijs/core/types" />

import { fileURLToPath } from "node:url";
import vike from "vike/plugin";
import { defineConfig } from "vite";
import vercel from "vite-plugin-vercel/vite";

export default defineConfig({
    envLoader: { quiet: true },
    plugins: [vike(), react(), vercel()],
    optimizeDeps: {
        include: ["@streamdown/code"],
    },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./", import.meta.url)),
        },
    },
});
