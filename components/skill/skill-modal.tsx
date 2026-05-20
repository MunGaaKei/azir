import request from "@/server/request";
import { useSkillsStore } from "@/stores/skills";
import { tryto } from "@/utils";
import { Pickaxe } from "lucide-react";
import PubSub from "pubsub-js";
import { useEffect, useState } from "react";
import { SettingModal, SettingSidebar } from "../modalSetting";
import { SkillFormPanel } from "./skill-form-panel";
import { SKILLS_UPDATED_TOPIC, SKILL_MODAL_OPEN_TOPIC } from "./utils";

export function SkillModal() {
    const skills = useSkillsStore((state) => state.skills);
    const initSkills = useSkillsStore((state) => state.initSkills);
    const setSkills = useSkillsStore((state) => state.setSkills);
    const [visible, setVisible] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    useEffect(() => {
        initSkills().catch(() => undefined);

        const token = PubSub.subscribe(SKILL_MODAL_OPEN_TOPIC, () => {
            setVisible(true);
        });
        return () => {
            PubSub.unsubscribe(token);
        };
    }, [initSkills]);

    const selectedSkill = editingId
        ? (skills.find((s) => s.id === editingId) ?? null)
        : null;

    const handleSelect = (id: number | string) => {
        setEditingId(Number(id));
    };

    const handleNew = () => {
        setEditingId(null);
    };

    const handleDelete = async (id: number) => {
        const { error } = await tryto(
            request(`/api/skills/remote/${id}`, { method: "DELETE" }),
        );
        if (!error) {
            setSkills(skills.filter((s) => s.id !== id));
            if (editingId === id) setEditingId(null);
        }
    };

    const handleSaveSuccess = (id: number) => {
        const wasCreating = editingId === null;
        setEditingId(id);
        initSkills();
        PubSub.publish(SKILLS_UPDATED_TOPIC);
        if (wasCreating) {
            closeModal();
        }
    };

    const closeModal = () => {
        setVisible(false);
        setEditingId(null);
    };

    return (
        <SettingModal
            visible={visible}
            onClose={closeModal}
            title="技能管理"
            icon={Pickaxe}
            width={640}
        >
            <SettingSidebar
                items={skills}
                editingId={editingId}
                onSelect={handleSelect}
                onCreate={handleNew}
                renderItem={(s) => s.name}
            />
            <SkillFormPanel
                skill={selectedSkill}
                onSaveSuccess={handleSaveSuccess}
                onDelete={handleDelete}
                onClose={closeModal}
            />
        </SettingModal>
    );
}
