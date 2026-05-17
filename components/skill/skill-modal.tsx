import request from "@/server/request";
import { tryto } from "@/utils";
import { Button, Flex, List, Modal } from "@ioca/react";
import { Inbox, Plus } from "lucide-react";
import PubSub from "pubsub-js";
import { useEffect, useState } from "react";
import css from "./index.module.css";
import { SkillFormPanel } from "./skill-form-panel";
import { SKILLS_UPDATED_TOPIC, SKILL_MODAL_OPEN_TOPIC, type SkillRecord } from "./utils";
import { useSkillsStore } from "@/stores/skills";

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

    const handleSelect = (skill: SkillRecord) => {
        setEditingId(skill.id);
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
        <Modal
            customized
            visible={visible}
            width={640}
            backdropClosable={false}
            onClose={closeModal}
        >
            <div className={css.header}>
                <b className="mr-auto">技能管理</b>
            </div>

            <Flex>
                <ul className={css.list}>
                    {skills.map((skill) => (
                        <List.Item
                            key={skill.id}
                            type="option"
                            className={css.item}
                            active={editingId === skill.id}
                            onClick={() => handleSelect(skill)}
                        >
                            {skill.name}
                        </List.Item>
                    ))}

                    {!skills.length ? (
                        <div className="flex py-20 justify-center">
                            <Inbox color="var(--color-5)" />
                        </div>
                    ) : null}

                    <Button
                        secondary
                        size="small"
                        className="mx-auto my-12"
                        onClick={handleNew}
                    >
                        <Plus size={16} /> 创建
                    </Button>
                </ul>

                <SkillFormPanel
                    skill={selectedSkill}
                    onSaveSuccess={handleSaveSuccess}
                    onDelete={handleDelete}
                    onClose={closeModal}
                />
            </Flex>
        </Modal>
    );
}
