import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma may execute this file from a build/cache directory, so
 * `dirname(import.meta.url)` is NOT reliable for locating `.env`.
 * Walk up from cwd until we find `prisma/schema.prisma`, then load `.env` there.
 */
function findProjectRootWithSchema(startDir: string): string | null {
  let dir = path.resolve(startDir);
  for (;;) {
    const schema = path.join(dir, "prisma", "schema.prisma");
    if (fs.existsSync(schema)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const fromCwd = findProjectRootWithSchema(process.cwd());
const configFileDir = path.dirname(fileURLToPath(import.meta.url));
const fromConfig =
  fs.existsSync(path.join(configFileDir, "prisma", "schema.prisma")) ? configFileDir : null;

const projectRoot = fromCwd ?? fromConfig ?? process.cwd();

dotenv.config({ path: path.join(projectRoot, ".env"), override: true });
dotenv.config({ path: path.join(projectRoot, ".env.local"), override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  },
  datasource: {
    url: env("DATABASE_URL")
  }
});
