/*
  Warnings:

  - Added the required column `status` to the `BalanceChange` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BalanceChange" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "paymentId" TEXT,
    "balance" INTEGER NOT NULL,
    "changeAmount" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PAYMENT',
    "status" TEXT NOT NULL
);
INSERT INTO "new_BalanceChange" ("balance", "changeAmount", "id", "paymentId", "type", "userId") SELECT "balance", "changeAmount", "id", "paymentId", "type", "userId" FROM "BalanceChange";
DROP TABLE "BalanceChange";
ALTER TABLE "new_BalanceChange" RENAME TO "BalanceChange";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
