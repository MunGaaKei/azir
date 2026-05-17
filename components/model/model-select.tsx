import { Button, Flex, Select } from "@ioca/react";
import type { ISelect } from "@ioca/react/components/select/type";
import { ModelModal } from "./model-modal";
import { BrainAnimate } from "../ui/brain-animate";
import { openModelModal } from "./shared";

export function ModelSelect(props: ISelect) {
    return (
        <Flex gap={8}>
            <Select {...props} />
            <Button
                secondary
                square
                aria-label="打开模型管理"
                onClick={() => {
                    openModelModal();
                }}
            >
                <BrainAnimate size={20} />
            </Button>

            <ModelModal />
        </Flex>
    );
}
