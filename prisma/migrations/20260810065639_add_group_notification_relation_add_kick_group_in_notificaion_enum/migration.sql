-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'GROUP_KICKED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "groupId" INTEGER;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
