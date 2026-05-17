import request from "@/server/request";
import { tryto } from "@/utils";
import type { Agent } from "@prisma/client";
import { create } from "zustand";

type AgentsStore = {
    agents: Agent[];
    initialized: boolean;
    loading: boolean;
    setAgents: (agents: Agent[]) => void;
    initAgents: () => Promise<void>;
};

export const useAgentsStore = create<AgentsStore>((set, get) => ({
    agents: [],
    initialized: false,
    loading: false,
    setAgents: (agents) => set({ agents, initialized: true }),
    initAgents: async () => {
        if (get().initialized || get().loading) {
            return;
        }

        set({ loading: true });

        const { error, data } = await tryto(request<Agent[]>("/api/agent"));

        if (error || !data) {
            set({ loading: false });
            throw error;
        }

        set({ agents: data, initialized: true, loading: false });
    },
}));
