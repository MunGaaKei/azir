import { Button, Popup } from "@ioca/react";
import { HardDrive } from "lucide-react";

export default function Drive(props) {
    const { projectId } = props;

    return (
        <Popup trigger="click" content={<div className="pd-12">drive</div>}>
            <Button flat square>
                <HardDrive size={20} />
            </Button>
        </Popup>
    );
}
