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
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 32 32"
                    width={24}
                    height={24}
                >
                    <path
                        d="M16 2a14 14 0 0 0-4.43 27.28c.7.13 1-.3 1-.67v-2.38c-3.89.84-4.71-1.88-4.71-1.88a3.71 3.71 0 0 0-1.62-2.05c-1.27-.86.1-.85.1-.85a2.94 2.94 0 0 1 2.14 1.45a3 3 0 0 0 4.08 1.16a2.93 2.93 0 0 1 .88-1.87c-3.1-.36-6.37-1.56-6.37-6.92a5.4 5.4 0 0 1 1.44-3.76a5 5 0 0 1 .14-3.7s1.17-.38 3.85 1.43a13.3 13.3 0 0 1 7 0c2.67-1.81 3.84-1.43 3.84-1.43a5 5 0 0 1 .14 3.7a5.4 5.4 0 0 1 1.44 3.76c0 5.38-3.27 6.56-6.39 6.91a3.33 3.33 0 0 1 .95 2.59v3.84c0 .46.25.81 1 .67A14 14 0 0 0 16 2z"
                        fill-rule="evenodd"
                        fill="currentColor"
                    ></path>
                </svg>
                <a
                    href="https://github.com/MunGaaKei/azir"
                    target="_blank"
                    style={{ fontSize: 14 }}
                >
                    https://github.com/MunGaaKei/azir
                </a>
                <i className="color-5 ml-auto">by iann :)</i>
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
