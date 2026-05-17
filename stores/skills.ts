import request from "@/server/request";
import { tryto } from "@/utils";
import type { SkillRecord } from "@/components/skill/utils";
import { create } from "zustand";
import type { SkillsStore } from "./type";

export const useSkillsStore = create<SkillsStore>((set, get) => ({
    skills: [],
    initialized: false,
    loading: false,
    setSkills: (skills) => set({ skills, initialized: true }),
    initSkills: async () => {
        if (get().initialized || get().loading) {
            return;
        }

        set({ loading: true });

        const { error, data } = await tryto(
            request<SkillRecord[]>("/api/skills/remote"),
        );

        if (error || !data) {
            set({ loading: false });
            throw error;
        }

        set({ skills: data, initialized: true, loading: false });
    },
}));
