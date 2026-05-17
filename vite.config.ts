import react from "@vitejs/plugin-react";
/// <reference types="@batijs/core/types" />

import { fileURLToPath } from "node:url";
import vike from "vike/plugin";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [vike(), react()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./", import.meta.url)),
        },
    },
});
