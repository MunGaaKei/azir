import vikeReact from "vike-react/config";
import type { Config } from "vike/types";

// Default config (can be overridden by pages)
// https://vike.dev/config

const config: Config = {
    // https://vike.dev/head-tags
    title: "AZIR ❋",
    description: "Azir Agents",
    ssr: true,
    bodyAttributes: {
        code: "iannism",
    },

    extends: [vikeReact],
};

export default config;
