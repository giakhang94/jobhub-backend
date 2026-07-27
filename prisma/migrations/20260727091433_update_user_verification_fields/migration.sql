-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "email_verification_token" TEXT,
ADD COLUMN     "email_verification_token_expiry" TIMESTAMP(3);
