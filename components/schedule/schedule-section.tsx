import { Checkbox, Editor, Flex, Form, TimePicker } from "@ioca/react";

const WEEK_DAY_OPTIONS = [
    { label: "周一", value: "1" },
    { label: "周二", value: "2" },
    { label: "周三", value: "3" },
    { label: "周四", value: "4" },
    { label: "周五", value: "5" },
    { label: "周六", value: "6" },
    { label: "周日", value: "7" },
];

export function ScheduleSection({
    enabled,
    onToggle,
}: {
    enabled: boolean;
    onToggle: (v: boolean) => void;
}) {
    return (
        <>
            <Flex align="center" gap={8}>
                <Checkbox
                    disabled
                    type="switch"
                    label="定时器"
                    options={[{ label: "开启", value: "enabled" }]}
                    value={enabled ? ["enabled"] : []}
                    onChange={(v: string[]) => onToggle(v.includes("enabled"))}
                />
            </Flex>

            {enabled && (
                <>
                    <Flex>
                        <Form.Field name="schedule.time">
                            <TimePicker
                                border
                                label="时间"
                                format="hh:mm"
                                width={240}
                            />
                        </Form.Field>
                    </Flex>
                    <Form.Field name="schedule.days">
                        <Checkbox
                            label="重复"
                            optionInline
                            options={WEEK_DAY_OPTIONS}
                        />
                    </Form.Field>

                    <Form.Field name="schedule.prompt">
                        <Editor
                            border
                            height="4em"
                            autosize
                            hideControl
                            placeholder="输入定时执行时的提示词"
                        />
                    </Form.Field>
                </>
            )}
        </>
    );
}
