/*
  Warnings:

  - The primary key for the `Connection` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Connection` table. All the data in the column will be lost.
  - Added the required column `hashId` to the `Connection` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Connection" (
    "hashId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "server_port" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "access_url" TEXT NOT NULL,
    "userId" INTEGER,
    CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Connection" ("access_url", "method", "name", "password", "server", "server_port", "userId") SELECT "access_url", "method", "name", "password", "server", "server_port", "userId" FROM "Connection";
DROP TABLE "Connection";
ALTER TABLE "new_Connection" RENAME TO "Connection";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
