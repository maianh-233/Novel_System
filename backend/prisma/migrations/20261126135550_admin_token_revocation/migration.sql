-- CreateTable
CREATE TABLE "RevokedAdminToken" (
    "jti" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevokedAdminToken_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "RevokedAdminToken_expiresAt_idx" ON "RevokedAdminToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "RevokedAdminToken" ADD CONSTRAINT "RevokedAdminToken_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
