/*
  Warnings:

  - The primary key for the `BalanceChange` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `BalanceChange` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - Added the required column `balance` to the `BalanceChange` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BalanceChange" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "paymentId" TEXT,
    "balance" INTEGER NOT NULL,
    "changeAmount" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PAYMENT'
);
INSERT INTO "new_BalanceChange" ("changeAmount", "id", "type", "userId") SELECT "changeAmount", "id", "type", "userId" FROM "BalanceChange";
DROP TABLE "BalanceChange";
ALTER TABLE "new_BalanceChange" RENAME TO "BalanceChange";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
