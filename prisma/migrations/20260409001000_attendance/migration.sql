-- Attendance feature (selfie + location + timestamps)

CREATE TABLE IF NOT EXISTS "Attendance" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT,
  "userId" TEXT NOT NULL,

  "checkInAt" TIMESTAMP(3) NOT NULL,
  "checkInLat" DOUBLE PRECISION,
  "checkInLng" DOUBLE PRECISION,
  "checkInPhoto" TEXT NOT NULL,

  "checkOutAt" TIMESTAMP(3),
  "checkOutLat" DOUBLE PRECISION,
  "checkOutLng" DOUBLE PRECISION,
  "checkOutPhoto" TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Attendance_companyId_checkInAt_idx"
  ON "Attendance"("companyId", "checkInAt");

CREATE INDEX IF NOT EXISTS "Attendance_userId_checkInAt_idx"
  ON "Attendance"("userId", "checkInAt");

CREATE INDEX IF NOT EXISTS "Attendance_branchId_checkInAt_idx"
  ON "Attendance"("branchId", "checkInAt");

ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

