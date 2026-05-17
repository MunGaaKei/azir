import vikeReact from "vike-react/config";
import type { Config } from "vike/types";

// Default config (can be overridden by pages)
// https://vike.dev/config

const config: Config = {
    // https://vike.dev/head-tags
    title: "Agent M",
    description: "Agent M",
    ssr: false,

    extends: [vikeReact],
};

export default config;
