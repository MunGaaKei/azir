import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

dotenv.config({
	path: ".env",
	override: true,
});

export default defineConfig({
	schema: "prisma/schema.prisma",
	datasource: {
		url: env("DATABASE_URL"),
	},
});
