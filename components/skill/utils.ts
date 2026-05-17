export const SKILL_MODAL_OPEN_TOPIC = "skill-modal:open";
export const SKILLS_UPDATED_TOPIC = "skills:updated";

export type SkillRecord = {
    id: number;
    name: string;
    description: string;
    repoUrl: string;
    skillMd: string;
    rules: Array<{ name: string; content: string }>;
    rulesCount: number;
    createdAt: string;
};
