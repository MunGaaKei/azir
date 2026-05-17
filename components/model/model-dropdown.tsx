import { useModelsStore } from "@/stores/models";
import { Button, Dropdown } from "@ioca/react";
import { ModelModal } from "./model-modal";
import { CreateModelButton, openModelModal } from "./shared";
import { BrainAnimate } from "../ui/brain-animate";

export function ModelDropdown() {
    const models = useModelsStore((state) => state.models);

    return (
        <>
            <Dropdown
                content={(close) => (
                    <>
                        {models.map((model) => (
                            <Dropdown.Item
                                key={model.id}
                                type="option"
                                onClick={() => {
                                    close();
                                    openModelModal(model);
                                }}
                            >
                                {model.name}
                            </Dropdown.Item>
                        ))}

                        <CreateModelButton
                            onBeforeOpen={() => {
                                close();
                            }}
                        />
                    </>
                )}
                width={120}
            >
                <Button square flat aria-label="打开模型菜单">
                    <BrainAnimate size={24} />
                </Button>
            </Dropdown>

            <ModelModal />
        </>
    );
}
