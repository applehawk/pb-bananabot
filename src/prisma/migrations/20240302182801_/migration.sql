/*
  Warnings:

  - You are about to drop the column `monthCount` on the `Payment` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Tariff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "connectionsLimit" INTEGER NOT NULL,
    "price" INTEGER NOT NULL
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Payment" (
    "paymentId" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentSystem" TEXT NOT NULL DEFAULT 'YOOMONEY',
    "userId" INTEGER NOT NULL,
    "chatId" INTEGER NOT NULL,
    "tariffId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentAt" DATETIME NOT NULL,
    "paymentAmount" INTEGER NOT NULL,
    "paymentCurrency" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "transactionId" TEXT,
    "payerAmount" TEXT,
    "payerCurrency" TEXT,
    "network" TEXT,
    "address" TEXT,
    "from" TEXT,
    "txid" TEXT,
    "form" TEXT NOT NULL,
    "isFinal" BOOLEAN,
    "email" TEXT
);
INSERT INTO "new_Payment" ("address", "amount", "chatId", "description", "email", "form", "from", "isFinal", "network", "orderId", "payerAmount", "payerCurrency", "paymentAmount", "paymentAt", "paymentCurrency", "paymentId", "paymentSystem", "status", "tariffId", "transactionId", "txid", "url", "userId") SELECT "address", "amount", "chatId", "description", "email", "form", "from", "isFinal", "network", "orderId", "payerAmount", "payerCurrency", "paymentAmount", "paymentAt", "paymentCurrency", "paymentId", "paymentSystem", "status", "tariffId", "transactionId", "txid", "url", "userId" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "Tariff_id_key" ON "Tariff"("id");

-- CreateIndex
CREATE INDEX "Tariff_price_connectionsLimit_idx" ON "Tariff"("price", "connectionsLimit");
