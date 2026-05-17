import { Flex, Select } from "@ioca/react";
import type { ISelect } from "@ioca/react/components/select/type";
import { ManageSkillButton } from "./shared";

export function SkillSelect(props: ISelect) {
    return (
        <Flex gap={8}>
            <Select {...props} />

            <ManageSkillButton />
        </Flex>
    );
}
