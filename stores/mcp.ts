import request from "@/server/request";
import { tryto } from "@/utils";
import type { MCPRecord } from "@/components/mcp/types";
import { create } from "zustand";
import type { MCPStore } from "./type";

export const useMcpStore = create<MCPStore>((set, get) => ({
    servers: [],
    initialized: false,
    loading: false,
    setServers: (servers) => set({ servers, initialized: true }),
    initServers: async () => {
        if (get().initialized || get().loading) {
            return;
        }

        set({ loading: true });

        const { error, data } = await tryto(
            request<MCPRecord[]>("/api/mcp/remote"),
        );

        if (error || !data) {
            set({ loading: false });
            throw error;
        }

        set({ servers: data, initialized: true, loading: false });
    },
    refreshServers: async () => {
        set({ loading: true });

        const { error, data } = await tryto(
            request<MCPRecord[]>("/api/mcp/remote"),
        );

        if (error || !data) {
            set({ loading: false });
            throw error;
        }

        set({ servers: data, initialized: true, loading: false });
    },
}));
