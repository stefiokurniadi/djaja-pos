/*
  Make categories company-wide (universal) instead of branch-scoped.

  Backfill strategy:
  - Add companyId to Category (nullable)
  - Populate companyId by joining Category.branchId -> Branch.companyId
  - Make companyId NOT NULL
  - Drop FK + column branchId from Category
  - Update unique/index constraints
*/

ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

UPDATE "Category" c
SET "companyId" = b."companyId"
FROM "Branch" b
WHERE c."companyId" IS NULL
  AND c."branchId" = b."id";

ALTER TABLE "Category" ALTER COLUMN "companyId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Category_companyId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "Category" ADD CONSTRAINT "Category_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

-- Drop old unique constraint/index and FK
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Category_branchId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "Category" DROP CONSTRAINT "Category_branchId_fkey"';
  END IF;
END $$;

DROP INDEX IF EXISTS "Category_branchId_idx";
DROP INDEX IF EXISTS "Category_branchId_name_key";

-- Drop branchId column (now universal)
ALTER TABLE "Category" DROP COLUMN IF EXISTS "branchId";

CREATE INDEX IF NOT EXISTS "Category_companyId_idx" ON "Category"("companyId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'Category_companyId_name_key'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX "Category_companyId_name_key" ON "Category"("companyId","name")';
  END IF;
END $$;

