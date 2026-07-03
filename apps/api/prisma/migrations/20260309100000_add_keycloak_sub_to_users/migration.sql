-- Add keycloak_sub column to users table for Keycloak SSO integration
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "keycloak_sub" VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS "users_keycloak_sub_key" ON "users"("keycloak_sub");

-- Make password_hash nullable: Keycloak-provisioned users have no local password
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
