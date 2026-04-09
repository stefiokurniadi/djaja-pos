-- Add SUPERADMIN role for global oversight

-- Postgres enum alteration (Prisma Role enum)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' AND e.enumlabel = 'SUPERADMIN'
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'SUPERADMIN';
  END IF;
END $$;

