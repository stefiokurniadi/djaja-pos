import "dotenv/config";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db";

/** Stable IDs so `prisma db seed` is idempotent. */
const SEED_COMPANY_ID = "seed-default-company";
const SEED_BRANCH_ID = "default-branch";

async function main() {
  const company = await prisma.company.upsert({
    where: { id: SEED_COMPANY_ID },
    update: {},
    create: {
      id: SEED_COMPANY_ID,
      name: "Default Company"
    }
  });

  const branch = await prisma.branch.upsert({
    where: { id: SEED_BRANCH_ID },
    update: { companyId: company.id },
    create: {
      id: SEED_BRANCH_ID,
      companyId: company.id,
      name: "Main Branch"
    }
  });

  const passwordHash = await bcrypt.hash("password123", 12);

  await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {
      companyId: company.id,
      role: Role.OWNER,
      branchId: null
    },
    create: {
      email: "owner@example.com",
      name: "Owner",
      role: Role.OWNER,
      companyId: company.id,
      branchId: null,
      passwordHash
    }
  });

  await prisma.user.updateMany({
    where: { email: "owner@example.com", passwordHash: null },
    data: { passwordHash }
  });

  console.log("Seed OK:", { companyId: company.id, branchId: branch.id });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
