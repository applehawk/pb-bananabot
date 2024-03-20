/*
  Warnings:

  - The primary key for the `Connection` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `id` to the `Connection` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Connection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hashId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "server_port" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "access_url" TEXT NOT NULL,
    "userId" INTEGER,
    CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Connection" ("access_url", "hashId", "method", "name", "password", "server", "server_port", "userId") SELECT "access_url", "hashId", "method", "name", "password", "server", "server_port", "userId" FROM "Connection";
DROP TABLE "Connection";
ALTER TABLE "new_Connection" RENAME TO "Connection";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
