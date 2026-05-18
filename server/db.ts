import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({
	path: ".env",
	override: true,
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL is not set");
}

const globalForPrisma = globalThis as typeof globalThis & {
	prisma?: PrismaClient;
};

const isSupabase = connectionString.includes("supabase.co");

const poolUrl = isSupabase
	? connectionString.replace(/[?&]sslmode=\w+/g, "")
	: connectionString;

const pool = new pg.Pool({
	connectionString: poolUrl,
	...(isSupabase && { ssl: { rejectUnauthorized: false } }),
});

const adapter = new PrismaPg(pool, {
	...(isSupabase && { schema: "azir" }),
	disposeExternalPool: true,
});

export const db =
	globalForPrisma.prisma ??
	new PrismaClient({
		adapter,
	});

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = db;
}
