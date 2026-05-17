import { useActivityStore } from "@/stores/activity";
import { Flex, Tag } from "@ioca/react";
import { useMemo } from "react";

const activityMap = {
    running: {
        text: "执行中",
        class: "bg-blue",
    },
    done: {
        text: "已完成",
        class: "bg-success-0 success",
    },
    error: {
        text: "失败",
        class: "bg-error",
    },
    stopped: {
        text: "已中断",
        class: "",
    },
};

function formatDuration(startAt: number, endAt: number) {
    const seconds = Math.max(0, Math.round((endAt - startAt) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}m ${sec}s`;
}

export default function AgentActivity({ agentId }: { agentId: number }) {
    const storeActivities = useActivityStore((state) => state.activities);
    const activities = useMemo(
        () =>
            storeActivities
                .filter((activity) => activity.agentId === agentId)
                .sort((a, b) => b.updatedAt - a.updatedAt),
        [agentId, storeActivities],
    );

    if (!activities.length) {
        return <div className="my-24 color-5 text-center">暂无活动</div>;
    }

    return (
        <div className="flex flex-column gap-8">
            {activities.map((activity) => {
                const statusInfo = activityMap[activity.status];

                return (
                    <section key={activity.id}>
                        <Flex align="center" gap={8}>
                            <Tag className={statusInfo.class}>
                                {statusInfo.text}
                            </Tag>

                            <i
                                className="color-5 ml-auto"
                                style={{ fontSize: 12 }}
                            >
                                {formatDuration(
                                    activity.createdAt,
                                    activity.updatedAt,
                                )}
                            </i>
                        </Flex>
                    </section>
                );
            })}
        </div>
    );
}
