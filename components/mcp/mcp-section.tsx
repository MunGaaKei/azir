import { Flex, Select } from "@ioca/react";
import type { ISelect } from "@ioca/react/components/select/type";
import { ManageMCPButton } from "./shared";

export function MCPSection(props: ISelect) {
    return (
        <Flex gap={8}>
            <Select {...props} />

            <ManageMCPButton />
        </Flex>
    );
}
