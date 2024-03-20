-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BalanceChange" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "paymentId" TEXT,
    "balance" INTEGER NOT NULL,
    "changeAmount" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PAYMENT',
    "status" TEXT NOT NULL,
    "changeAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_BalanceChange" ("balance", "changeAmount", "id", "paymentId", "status", "type", "userId") SELECT "balance", "changeAmount", "id", "paymentId", "status", "type", "userId" FROM "BalanceChange";
DROP TABLE "BalanceChange";
ALTER TABLE "new_BalanceChange" RENAME TO "BalanceChange";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
