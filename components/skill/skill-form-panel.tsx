import request, { useAbort } from "@/server/request";
import { tryto } from "@/utils";
import { Button, Flex, Form, Input, Popconfirm, Radio } from "@ioca/react";
import { useEffect, useState } from "react";
import type { SkillRecord } from "./utils";

type CreateMode = "github" | "manual";

const required = {
    validator: (value: unknown) => !!value,
    message: "",
};

function emptyForm() {
    return {
        name: "",
        description: "",
        repoUrl: "",
        skillMd: "",
        content: "",
    };
}

function formatRulesToText(
    rules: Array<{ name: string; content: string }>,
): string {
    return rules.map((r) => `### ${r.name}\n${r.content}`).join("\n\n");
}

function parseRulesText(
    text: string,
): Array<{ name: string; content: string }> {
    return text
        .split(/(?=###\s)/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => {
            const match = block.match(/^###\s+(.+)\n([\s\S]*?)$/);
            if (match) {
                return { name: match[1].trim(), content: match[2].trim() };
            }
            return null;
        })
        .filter(
            (r): r is { name: string; content: string } =>
                r !== null && !!r.name,
        );
}

type SkillFormPanelProps = {
    skill: SkillRecord | null;
    onSaveSuccess: (id: number) => void;
    onDelete: (id: number) => void;
    onClose: () => void;
};

export function SkillFormPanel({
    skill,
    onSaveSuccess,
    onDelete,
    onClose,
}: SkillFormPanelProps) {
    const isNew = skill === null;
    const [rulesText, setRulesText] = useState("");
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);
    const [createMode, setCreateMode] = useState<CreateMode>("github");
    const { signal, cancel } = useAbort();
    const form = Form.useForm();

    useEffect(() => {
        if (isNew) {
            form.set(emptyForm());
            setRulesText("");
            setCreateMode("github");
        } else {
            form.set({
                name: skill.name,
                description: skill.description,
                repoUrl: skill.repoUrl,
                skillMd: skill.skillMd,
            });
            const rules = (skill.rules || []) as Array<{
                name: string;
                content: string;
            }>;
            setRulesText(formatRulesToText(rules));
        }
    }, [skill, form, isNew]);

    const handleGitHubImport = async () => {
        const raw = form.get("repoUrl") as string;
        if (!raw?.trim()) return;

        setImporting(true);
        const { error, data } = await tryto(
            request<SkillRecord>("/api/skills/remote", {
                method: "POST",
                body: { name: raw.trim() },
                signal: signal(),
            }),
        );
        setImporting(false);
        if (error || !data) {
            if (
                error instanceof DOMException &&
                error.name === "AbortError"
            )
                return;
            throw error;
        }

        onSaveSuccess(data.id);
    };

    const handleSave = async () => {
        const values = await form.validate();
        if (typeof values === "boolean") return;

        setSaving(true);

        try {
            const payload: Record<string, unknown> = {};

            if (isNew && createMode === "manual") {
                payload.content = (values.content || "").trim();
            } else if (isNew && createMode === "github") {
                await handleGitHubImport();
                return;
            } else if (!isNew) {
                payload.name = (values.name || "").trim();
                payload.description = (values.description || "").trim();
                payload.skillMd = (values.skillMd || "").trim();
                payload.rules = parseRulesText(rulesText);
            }

            if (!payload.content && !(payload.name as string)?.trim()) {
                return;
            }

            const { error, data } = await tryto(
                !isNew
                    ? request<SkillRecord>(`/api/skills/remote/${skill!.id}`, {
                          method: "PUT",
                          body: payload,
                          signal: signal(),
                      })
                    : request<SkillRecord>("/api/skills/remote", {
                          method: "POST",
                          body: payload,
                          signal: signal(),
                      }),
            );

            if (error || !data) {
                if (
                    error instanceof DOMException &&
                    error.name === "AbortError"
                )
                    return;
                throw new Error("保存失败");
            }

            onSaveSuccess(data.id);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        cancel();
        onClose();
    };

    if (!isNew && !skill) return null;

    return (
        <div className="flex-1 pd-12" style={{ minWidth: 0 }}>
            <Form
                form={form}
                rules={{ name: required, repoUrl: required }}
                labelInline
                labelWidth="5em"
                labelRight
            >
                {isNew && (
                    <Form.Field>
                        <Radio
                            optionInline
                            value={createMode}
                            type="button"
                            options={[
                                { label: "从GitHub导入", value: "github" },
                                { label: "手动填写", value: "manual" },
                            ]}
                            onChange={(v: CreateMode) => setCreateMode(v)}
                        />
                    </Form.Field>
                )}

                {(!isNew || createMode === "github") && (
                    <>
                        <Form.Field name="name" required>
                            <Input
                                label="名称"
                                border
                                placeholder="react-best-practices"
                            />
                        </Form.Field>

                        {isNew && createMode === "github" && (
                            <Form.Field name="repoUrl" required>
                                <Input
                                    label="仓库地址"
                                    border
                                    placeholder="https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices"
                                />
                            </Form.Field>
                        )}
                    </>
                )}

                {isNew && createMode === "manual" && (
                    <Form.Field name="content">
                        <Input.Textarea
                            placeholder={`---\nname: 技能名称\ndescription: 技能描述\n---\n\n技能内容...\n\n## 规则\n\n### 规则名称\n规则内容\n`}
                            border
                            autoSize
                            rows={16}
                            resize={false}
                        />
                    </Form.Field>
                )}

                {!isNew && (
                    <>
                        <Form.Field name="description">
                            <Input label="描述" border />
                        </Form.Field>

                        <Form.Field name="skillMd">
                            <Input.Textarea
                                label="SKILL.md"
                                border
                                rows={6}
                                resize={false}
                            />
                        </Form.Field>

                        <Form.Field>
                            <Input.Textarea
                                label="规则"
                                border
                                rows={6}
                                resize={false}
                                value={rulesText}
                                onChange={(v: string) => setRulesText(v)}
                                placeholder={`### 规则名称\n规则内容\n\n### 另一个规则\n另一个规则内容`}
                            />
                        </Form.Field>
                    </>
                )}

                <Flex justify="end" className="mt-8" gap={8}>
                    {!isNew && (
                        <Popconfirm
                            icon={null}
                            content="确定删除技能"
                            okButtonProps={{ className: "bg-error" }}
                            onOk={() => onDelete(skill!.id)}
                        >
                            <Button secondary className="mr-auto error">
                                删除
                            </Button>
                        </Popconfirm>
                    )}
                    <Button flat onClick={handleCancel}>
                        取消
                    </Button>
                    <Button loading={saving} onClick={() => void handleSave()}>
                        {!isNew ? "更新" : "创建"}
                    </Button>
                </Flex>
            </Form>
        </div>
    );
}
