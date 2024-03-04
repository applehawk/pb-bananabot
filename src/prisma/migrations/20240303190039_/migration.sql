-- CreateTable
CREATE TABLE "BalanceChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "changeAmount" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "BalanceChange_id_key" ON "BalanceChange"("id");
