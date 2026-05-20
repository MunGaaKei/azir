import { useActivityStore } from "@/stores/activity";
import { Tag } from "@ioca/react";
import { useMemo } from "react";

const activityMap: Record<string, { text: string; class: string }> = {
    running: { text: "执行中", class: "bg-blue" },
    done: { text: "已完成", class: "bg-success-0 success" },
    error: { text: "失败", class: "bg-error" },
    stopped: { text: "已中断", class: "" },
};

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
                if (!statusInfo) return null;

                return (
                    <section key={activity.id}>
                        <Tag className={statusInfo.class}>
                            {statusInfo.text}
                        </Tag>
                    </section>
                );
            })}
        </div>
    );
}
