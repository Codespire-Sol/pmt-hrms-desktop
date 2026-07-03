-- Add gender enum type
CREATE TYPE "gender" AS ENUM ('male', 'female', 'other');

-- Add gender column to employees table
ALTER TABLE "employees" ADD COLUMN "gender" "gender";

-- Create onboarding_otps table for email OTP verification during self-registration
CREATE TABLE "onboarding_otps" (
  "id"          UUID         NOT NULL DEFAULT uuid_generate_v4(),
  "employee_id" UUID         NOT NULL,
  "otp_hash"    VARCHAR(64)  NOT NULL,
  "expires_at"  TIMESTAMPTZ  NOT NULL,
  "verified_at" TIMESTAMPTZ,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "onboarding_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "onboarding_otps_employee_id_idx" ON "onboarding_otps"("employee_id");

ALTER TABLE "onboarding_otps"
  ADD CONSTRAINT "onboarding_otps_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
