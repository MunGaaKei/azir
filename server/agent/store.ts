import { db } from "../db";

const withModel = {
	model: true,
} as const;

const findManyArgs = {
	include: withModel,
	orderBy: {
		id: "asc",
	},
} as const;

function toData(data: {
	name: string;
	desc: string | null;
	modelId: number;
	skills: string[];
	permissions: Array<"websearch" | "docs">;
	uid: string;
	meta?: Record<string, unknown>;
	routable?: boolean;
}) {
	return {
		name: data.name,
		desc: data.desc,
		modelId: data.modelId,
		skills: data.skills,
		permissions: data.permissions,
		uid: data.uid,
		routable: data.routable ?? true,
		...(data.meta !== undefined ? { meta: data.meta as Record<string, string | boolean | number | null> } : {}),
	};
}

export async function getAgentById(id: number, uid: string) {
	return db.agent.findFirst({
		where: {
			id,
			uid,
		},
		include: withModel,
	});
}

export type AgentWithModel = NonNullable<
	Awaited<ReturnType<typeof getAgentById>>
>;

export async function getAgentsByIds(ids: number[], uid: string) {
	if (!ids.length) {
		return [];
	}

	const agents = await db.agent.findMany({
		where: {
			id: {
				in: ids,
			},
			uid,
		},
		include: withModel,
	});

	return ids
		.map((id) => agents.find((agent) => agent.id === id) ?? null)
		.filter((agent): agent is AgentWithModel => !!agent);
}

export async function getAgentCandidates(uid: string) {
	return db.agent.findMany({
		where: {
			desc: {
				not: null,
			},
			routable: true,
			uid,
		},
		...findManyArgs,
	});
}

export async function getAllAgents(uid: string) {
	return db.agent.findMany({
		where: { uid },
		...findManyArgs,
	});
}

export const listAgents = getAllAgents;

export async function createAgent(data: {
	name: string;
	desc: string | null;
	modelId: number;
	skills: string[];
	permissions: Array<"websearch" | "docs">;
	uid: string;
	meta?: Record<string, unknown>;
	routable?: boolean;
}) {
	return db.agent.create({
		data: toData(data),
		include: withModel,
	});
}

export async function updateAgent(
	id: number,
	uid: string,
	data: {
		name: string;
		desc: string | null;
		modelId: number;
		skills: string[];
		permissions: Array<"websearch" | "docs">;
		meta?: Record<string, unknown>;
		routable?: boolean;
	},
) {
	return db.agent.update({
		where: {
			id,
			uid,
		},
		data: {
			name: data.name,
			desc: data.desc,
			modelId: data.modelId,
			skills: data.skills,
			permissions: data.permissions,
			routable: data.routable ?? true,
			...(data.meta !== undefined ? { meta: data.meta as Record<string, string | boolean | number | null> } : {}),
		},
		include: withModel,
	});
}

export async function deleteAgent(id: number) {
    return db.agent.delete({ where: { id } });
}
