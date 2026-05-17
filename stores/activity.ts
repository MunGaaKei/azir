import { create } from "zustand";
import type { ActivityStatus, ActivityStore, AgentActivity } from "./type";

export type { ActivityStatus, AgentActivity };

function upsertActivity(
    activities: AgentActivity[],
    id: string,
    updater: (current?: AgentActivity) => AgentActivity,
) {
    const index = activities.findIndex((activity) => activity.id === id);

    if (index < 0) {
        return [updater(), ...activities];
    }

    const next = activities.slice();
    next[index] = updater(next[index]);
    return next;
}

export const useActivityStore = create<ActivityStore>((set) => ({
    activities: [],
    start: (payload) =>
        set((state) => ({
            activities: upsertActivity(
                state.activities,
                payload.id,
                (current) => {
                    const now = Date.now();

                    return {
                        id: payload.id,
                        requestId: payload.requestId,
                        agentId: payload.agentId,
                        agentName: payload.agentName,
                        status: "running",
                        createdAt: current?.createdAt ?? now,
                        updatedAt: now,
                    };
                },
            ),
        })),
    append: (payload) =>
        set((state) => ({
            activities: upsertActivity(
                state.activities,
                payload.id,
                (current) => {
                    const now = Date.now();

                    return {
                        id: payload.id,
                        requestId: payload.requestId,
                        agentId: payload.agentId,
                        agentName: payload.agentName,
                        status: "running",
                        createdAt: current?.createdAt ?? now,
                        updatedAt: now,
                    };
                },
            ),
        })),
    finish: (payload) =>
        set((state) => ({
            activities: upsertActivity(
                state.activities,
                payload.id,
                (current) => {
                    const now = Date.now();

                    return {
                        id: payload.id,
                        requestId: payload.requestId,
                        agentId: payload.agentId,
                        agentName: payload.agentName,
                        status: "done",
                        createdAt: current?.createdAt ?? now,
                        updatedAt: now,
                    };
                },
            ),
        })),
    fail: (payload) =>
        set((state) => ({
            activities: upsertActivity(
                state.activities,
                payload.id,
                (current) => {
                    const now = Date.now();

                    return {
                        id: payload.id,
                        requestId: payload.requestId,
                        agentId: payload.agentId,
                        agentName: payload.agentName,
                        status: "error",
                        createdAt: current?.createdAt ?? now,
                        updatedAt: now,
                    };
                },
            ),
        })),
    stopRunning: (activityId) =>
        set((state) => ({
            activities: state.activities.map((activity) =>
                activity.status === "running" &&
                (!activityId || activity.id === activityId)
                    ? {
                          ...activity,
                          status: "stopped",
                          updatedAt: Date.now(),
                      }
                    : activity,
            ),
        })),
}));
