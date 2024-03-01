/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `key_id` on the `User` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "tgid" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "firstname" TEXT,
    "lastname" TEXT,
    "nickname" TEXT,
    "chatId" INTEGER,
    "connLimit" INTEGER NOT NULL
);
INSERT INTO "new_User" ("chatId", "connLimit", "firstname", "lastname", "nickname", "tgid") SELECT "chatId", "connLimit", "firstname", "lastname", "nickname", "tgid" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE TABLE "new_Connection" (
    "key_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tgid" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "server_port" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "access_url" TEXT NOT NULL,
    "userKey_id" INTEGER,
    CONSTRAINT "Connection_userKey_id_fkey" FOREIGN KEY ("userKey_id") REFERENCES "User" ("tgid") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Connection" ("access_url", "key_id", "method", "name", "password", "server", "server_port", "tgid", "userKey_id") SELECT "access_url", "key_id", "method", "name", "password", "server", "server_port", "tgid", "userKey_id" FROM "Connection";
DROP TABLE "Connection";
ALTER TABLE "new_Connection" RENAME TO "Connection";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
