import request from "@/server/request";
import { tryto } from "@/utils";
import type { Model } from "@prisma/client";
import { create } from "zustand";

type ModelsStore = {
    models: Model[];
    initialized: boolean;
    loading: boolean;
    setModels: (models: Model[]) => void;
    initModels: () => Promise<void>;
};

export const useModelsStore = create<ModelsStore>((set, get) => ({
    models: [],
    initialized: false,
    loading: false,
    setModels: (models) => set({ models, initialized: true }),
    initModels: async () => {
        if (get().initialized || get().loading) {
            return;
        }

        set({ loading: true });

        const { error, data } = await tryto(request<Model[]>("/api/model"));

        if (error || !data) {
            set({ loading: false });
            throw error;
        }

        set({ models: data, initialized: true, loading: false });
    },
}));
