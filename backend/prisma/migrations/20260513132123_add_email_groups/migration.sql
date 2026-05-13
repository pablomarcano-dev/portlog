-- CreateTable
CREATE TABLE "email_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "email_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_group_members" (
    "id" TEXT NOT NULL,
    "emailGroupId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "email_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_groups_name_idx" ON "email_groups"("name");

-- CreateIndex
CREATE INDEX "email_group_members_emailGroupId_idx" ON "email_group_members"("emailGroupId");

-- AddForeignKey
ALTER TABLE "email_group_members" ADD CONSTRAINT "email_group_members_emailGroupId_fkey" FOREIGN KEY ("emailGroupId") REFERENCES "email_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
