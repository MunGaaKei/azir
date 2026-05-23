import { Button, Checkbox, Popup } from "@ioca/react";
import { SlidersHorizontal } from "lucide-react";
import { memo } from "react";

export default memo(function ControlSetting({
    chatMode,
    onChange,
}: {
    chatMode: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <Popup
            position="top"
            touchable
            trigger="click"
            content={
                <div className="pd-12">
                    <Checkbox.Item
                        label="聊天模式"
                        type="switch"
                        value={chatMode}
                        onChange={onChange}
                    />
                </div>
            }
        >
            <Button flat square className="ml-auto">
                <SlidersHorizontal size={20} />
            </Button>
        </Popup>
    );
});
