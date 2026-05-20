import { Button, Checkbox, Popup } from "@ioca/react";
import { SlidersHorizontal } from "lucide-react";

export default function ControlSetting() {
    return (
        <Popup
            position="top"
            touchable
            trigger="click"
            content={
                <div className="pd-12">
                    <Checkbox.Item label="Chat" type="switch" />
                </div>
            }
        >
            <Button flat square className="ml-auto">
                <SlidersHorizontal size={20} />
            </Button>
        </Popup>
    );
}
