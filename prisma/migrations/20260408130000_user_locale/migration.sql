-- AddEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Locale') THEN
    CREATE TYPE "Locale" AS ENUM ('id', 'en');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locale" "Locale" NOT NULL DEFAULT 'id';

