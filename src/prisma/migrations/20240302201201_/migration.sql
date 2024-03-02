/*
  Warnings:

  - You are about to drop the column `connectionsLimit` on the `Tariff` table. All the data in the column will be lost.
  - You are about to drop the column `nickname` on the `User` table. All the data in the column will be lost.
  - Added the required column `caption` to the `Tariff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `period` to the `Tariff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `balance` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tariff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "caption" TEXT NOT NULL
);
INSERT INTO "new_Tariff" ("id", "name", "price") SELECT "id", "name", "price" FROM "Tariff";
DROP TABLE "Tariff";
ALTER TABLE "new_Tariff" RENAME TO "Tariff";
CREATE UNIQUE INDEX "Tariff_id_key" ON "Tariff"("id");
CREATE INDEX "Tariff_price_idx" ON "Tariff"("price");
CREATE TABLE "new_User" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chatId" INTEGER,
    "firstname" TEXT,
    "lastname" TEXT,
    "username" TEXT,
    "connLimit" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL
);
INSERT INTO "new_User" ("chatId", "connLimit", "firstname", "lastname", "userId") SELECT "chatId", "connLimit", "firstname", "lastname", "userId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
