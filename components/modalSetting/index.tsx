import { Button, Flex, List, Modal, Popconfirm } from "@ioca/react";
import { Inbox, Plus, Trash2 } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import css from "./index.module.css";

// ---- Modal Shell ----

export function SettingModal({
    visible,
    onClose,
    title,
    icon: Icon,
    width = 640,
    children,
}: {
    visible: boolean;
    onClose: () => void;
    title: string;
    icon?: ComponentType<{ size?: number }>;
    width?: number;
    children: ReactNode;
}) {
    return (
        <Modal
            customized
            visible={visible}
            width={width}
            backdropClosable={false}
            onClose={onClose}
        >
            <div className={css.header}>
                {Icon && <Icon size={20} />}
                <b>{title}</b>
            </div>
            <Flex>{children}</Flex>
        </Modal>
    );
}

// ---- Sidebar ----

export type SettingItemBase = { id: number | string };

export function SettingSidebar<T extends SettingItemBase>({
    items,
    editingId,
    onSelect,
    onCreate,
    renderItem,
}: {
    items: T[];
    editingId: number | string | null;
    onSelect: (id: number | string) => void;
    onCreate: () => void;
    renderItem: (item: T) => ReactNode;
}) {
    return (
        <ul className={css.list}>
            {items.map((item) => (
                <List.Item
                    key={item.id}
                    type="option"
                    className={css.item}
                    active={editingId === item.id}
                    onClick={() => onSelect(item.id)}
                >
                    {renderItem(item)}
                </List.Item>
            ))}

            {!items.length && (
                <div className="flex py-20 justify-center">
                    <Inbox color="var(--color-5)" />
                </div>
            )}

            <Button
                secondary
                size="small"
                className="mx-auto my-12"
                onClick={onCreate}
            >
                <Plus size={16} /> 创建
            </Button>
        </ul>
    );
}

// ---- Right panel wrapper ----

export function SettingPanel({ children }: { children: ReactNode }) {
    return <div className={css.panel}>{children}</div>;
}

// ---- Footer with delete/cancel/submit ----

export function SettingFooter({
    editing,
    onDelete,
    onCancel,
    onSubmit,
    submitting,
    submitLabel,
}: {
    editing: boolean;
    onDelete?: () => void;
    onCancel: () => void;
    onSubmit: () => void;
    submitting?: boolean;
    submitLabel?: string;
}) {
    return (
        <Flex justify="end" className="mt-8" gap={8}>
            {editing && onDelete && (
                <Popconfirm
                    icon={null}
                    content="确定删除"
                    okButtonProps={{ className: "bg-error" }}
                    onOk={onDelete}
                >
                    <Button secondary className="mr-auto error">
                        <Trash2 size={14} /> 删除
                    </Button>
                </Popconfirm>
            )}
            <Button flat onClick={onCancel}>
                取消
            </Button>
            <Button loading={submitting} onClick={onSubmit}>
                {submitLabel || (editing ? "更新" : "创建")}
            </Button>
        </Flex>
    );
}
