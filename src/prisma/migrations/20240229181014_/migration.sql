/*
  Warnings:

  - You are about to drop the column `userKey_id` on the `Connection` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Connection" (
    "key_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tgid" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "server_port" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "access_url" TEXT NOT NULL,
    "user_tgid" INTEGER,
    CONSTRAINT "Connection_user_tgid_fkey" FOREIGN KEY ("user_tgid") REFERENCES "User" ("tgid") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Connection" ("access_url", "key_id", "method", "name", "password", "server", "server_port", "tgid") SELECT "access_url", "key_id", "method", "name", "password", "server", "server_port", "tgid" FROM "Connection";
DROP TABLE "Connection";
ALTER TABLE "new_Connection" RENAME TO "Connection";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
