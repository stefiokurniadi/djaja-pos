import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  seed: "node --loader ts-node/esm prisma/seed.ts"
});

