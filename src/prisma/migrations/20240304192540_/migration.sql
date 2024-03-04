-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BalanceChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "changeAmount" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PAYMENT'
);
INSERT INTO "new_BalanceChange" ("changeAmount", "id", "type", "userId") SELECT "changeAmount", "id", "type", "userId" FROM "BalanceChange";
DROP TABLE "BalanceChange";
ALTER TABLE "new_BalanceChange" RENAME TO "BalanceChange";
CREATE UNIQUE INDEX "BalanceChange_id_key" ON "BalanceChange"("id");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
