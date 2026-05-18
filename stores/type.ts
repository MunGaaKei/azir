export type ChatRole = "user" | "assistant";

export type ChatStatus = "streaming" | "done" | "error" | "stopped";

export type ChatMessage = {
    id: string;
    role: ChatRole;
    content: string;
    displayContent?: string;
    status: ChatStatus;
    projectId: string;
    requestId?: string;
    agentIds?: number[];
    agentId?: number;
    agentName?: string;
};

export type ChatProject = {
    id: string;
    name?: string;
};

export type ChatStreamEvent =
    | {
          type: "start";
          requestId: string;
          activityId: string;
          agentId: number;
          agentName: string;
      }
    | {
          type: "append";
          requestId: string;
          activityId: string;
          agentId: number;
          agentName: string;
          content: string;
      }
    | {
          type: "handoff";
          requestId: string;
          activityId: string;
          fromAgentId: number;
          fromAgentName: string;
          toAgentId: number;
          toAgentName: string;
      }
    | {
          type: "tool";
          requestId: string;
          activityId: string;
          agentId: number;
          agentName: string;
          toolName: string;
      }
    | {
          type: "done";
          requestId: string;
          activityId: string;
          agentId: number;
          agentName: string;
      }
    | {
          type: "error";
          requestId: string;
          activityId: string;
          agentId: number;
          agentName: string;
          message: string;
      };

export type SendPayload = {
    prompt: string;
    displayContent?: string;
    projectId?: string;
    agentIds?: number[];
    files?: Array<{
        name: string;
        base64: string;
        type: string;
    }>;
};

export type ChatStore = {
    projects: ChatProject[];
    currentProjectId: string;
    messages: ChatMessage[];
    loading: boolean;
    send: (payload: SendPayload) => Promise<void>;
    retry: (requestId: string) => Promise<void>;
    stop: (messageId: string, requestId?: string) => void;
    addProject: () => void;
    setCurrentProject: (projectId: string) => void;
    removeProject: (projectId: string) => void;
    setProjectName: (projectId: string, name: string) => void;
    clearMessages: (projectId: string) => void;
};

export type ChatStoreSetter = (
    partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>),
) => void;

export type ActivityStatus = "running" | "done" | "error" | "stopped";

export type AgentActivity = {
    id: string;
    requestId: string;
    agentId: number;
    agentName: string;
    status: ActivityStatus;
    createdAt: number;
    updatedAt: number;
};

export type ActivityPayload = {
    id: string;
    requestId: string;
    agentId: number;
    agentName: string;
};

export type ActivityStore = {
    activities: AgentActivity[];
    start: (payload: ActivityPayload) => void;
    append: (payload: ActivityPayload) => void;
    finish: (payload: ActivityPayload) => void;
    fail: (payload: ActivityPayload) => void;
    stopRunning: (activityId?: string) => void;
};

export type AgentsStore = {
    agents: import("@prisma/client").Agent[];
    initialized: boolean;
    loading: boolean;
    setAgents: (agents: import("@prisma/client").Agent[]) => void;
    initAgents: () => Promise<void>;
};

export type ModelsStore = {
    models: import("@prisma/client").Model[];
    initialized: boolean;
    loading: boolean;
    setModels: (models: import("@prisma/client").Model[]) => void;
    initModels: () => Promise<void>;
};

export type SkillsStore = {
    skills: import("@/components/skill/utils").SkillRecord[];
    initialized: boolean;
    loading: boolean;
    setSkills: (skills: import("@/components/skill/utils").SkillRecord[]) => void;
    initSkills: () => Promise<void>;
};

export type MCPStore = {
    servers: import("@/components/mcp/types").MCPRecord[];
    initialized: boolean;
    loading: boolean;
    setServers: (servers: import("@/components/mcp/types").MCPRecord[]) => void;
    initServers: () => Promise<void>;
    refreshServers: () => Promise<void>;
};
