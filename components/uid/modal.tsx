import request from "@/server/request";
import { Button, Flex, Input, Message, Modal } from "@ioca/react";
import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

function maskUid(uid: string) {
    if (uid.length <= 3) return uid;
    return uid.slice(0, 3) + "*".repeat(uid.length - 3);
}

function UidModal({ close }: { close: () => void }) {
    const [uid, setUid] = useState("");
    const [inputValue, setInputValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        request<{ uid: string }>("/api/uid")
            .then((data) => setUid(data.uid))
            .catch(() => undefined);
    }, []);

    const handleCopy = useCallback(async () => {
        if (!uid) return;
        try {
            await navigator.clipboard.writeText(uid);
            setCopied(true);
            Message.info("已复制");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            Message.error("复制失败");
        }
    }, [uid]);

    const handleUpdate = useCallback(async () => {
        const newUid = inputValue.trim();
        if (!newUid) return;

        setLoading(true);
        const { error, data } = await request<{ uid: string }>("/api/uid", {
            method: "PUT",
            body: { uid: newUid },
        }).then(
            (data) => ({ error: null, data }),
            (error) => ({ error, data: null }),
        );

        if (error || !data) {
            setLoading(false);
            return;
        }

        setUid(data.uid);
        setInputValue("");
        setLoading(false);

        close();
    }, [inputValue]);

    return (
        <div className="pd-16 flex flex-column gap-12" style={{ width: 400 }}>
            <Flex align="center" gap={8}>
                <span>
                    <i className="color-5 mr-4">UID:</i> {maskUid(uid)}
                </span>

                <Button
                    secondary
                    square
                    size="small"
                    onClick={handleCopy}
                    disabled={!uid}
                >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                </Button>
            </Flex>

            <Input
                type="password"
                border
                value={inputValue}
                onChange={(value) => setInputValue(String(value ?? ""))}
                append={
                    <Button loading={loading} onClick={handleUpdate}>
                        修改
                    </Button>
                }
            />

            <Flex gap={4} className="mt-8" align="center">
                <b>Github:</b>
                <a
                    href="https://github.com/MunGaaKei/azir"
                    target="_blank"
                    style={{ fontSize: 14 }}
                >
                    https://github.com/MunGaaKei/azir
                </a>
                <i className="color-5 ml-auto">#iannism :)</i>
            </Flex>
        </div>
    );
}

export function useUidModal() {
    const modal = Modal.useModal();

    const open = useCallback(() => {
        modal.open({
            customized: true,
            children: <UidModal close={modal.close} />,
        });
    }, [modal]);

    return { open };
}
