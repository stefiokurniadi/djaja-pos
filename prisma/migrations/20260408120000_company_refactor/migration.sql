/*
  Company + branch-scoped cashier refactor.

  This migration is written to be safe on an existing dev database that already
  has Branch/User rows, by:
  - creating a default Company
  - backfilling companyId on existing rows
  - relaxing User.branchId to nullable (OWNER/ADMIN no longer branch-dependent)
*/

-- 1) Role enum: ASSISTANT -> CASHIER
DO $$
BEGIN
  -- Only rename if the old value exists (allows re-runs on reset DBs)
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' AND e.enumlabel = 'ASSISTANT'
  ) THEN
    EXECUTE 'ALTER TYPE "Role" RENAME VALUE ''ASSISTANT'' TO ''CASHIER''';
  END IF;
END $$;

-- 2) Company table
CREATE TABLE IF NOT EXISTS "Company" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Company_name_idx" ON "Company"("name");

-- 3) Add companyId to Branch (nullable first), backfill, then make NOT NULL
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

-- Create a default company for existing data
INSERT INTO "Company" ("id", "name", "updatedAt")
VALUES ('default-company', 'Default Company', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

UPDATE "Branch"
SET "companyId" = 'default-company'
WHERE "companyId" IS NULL;

ALTER TABLE "Branch" ALTER COLUMN "companyId" SET NOT NULL;

-- Branch uniqueness within a company
CREATE INDEX IF NOT EXISTS "Branch_companyId_idx" ON "Branch"("companyId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'Branch_companyId_name_key'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX "Branch_companyId_name_key" ON "Branch"("companyId","name")';
  END IF;
END $$;

-- 4) Add companyId to User, relax branchId, backfill, then make companyId NOT NULL
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "User" ALTER COLUMN "branchId" DROP NOT NULL;

UPDATE "User"
SET "companyId" = 'default-company'
WHERE "companyId" IS NULL;

-- Owner/Admin are company-scoped, clear branch assignment
UPDATE "User"
SET "branchId" = NULL
WHERE "role" IN ('OWNER','ADMIN');

ALTER TABLE "User" ALTER COLUMN "companyId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "User_companyId_idx" ON "User"("companyId");

-- 5) Foreign keys (idempotent-ish)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Branch_companyId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_companyId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

