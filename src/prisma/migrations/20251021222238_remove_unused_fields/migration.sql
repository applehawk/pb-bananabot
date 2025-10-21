/*
  Warnings:

  - You are about to drop the `SceneStep` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `address` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `from` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `network` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `payerAmount` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `payerCurrency` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `txid` on the `Payment` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SceneStep";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
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
    "url" TEXT NOT NULL,
    "transactionId" TEXT,
    "form" TEXT NOT NULL,
    "isFinal" BOOLEAN,
    "email" TEXT
);
INSERT INTO "new_Payment" ("amount", "chatId", "email", "form", "isFinal", "orderId", "paymentAmount", "paymentAt", "paymentCurrency", "paymentId", "paymentSystem", "status", "tariffId", "transactionId", "url", "userId") SELECT "amount", "chatId", "email", "form", "isFinal", "orderId", "paymentAmount", "paymentAt", "paymentCurrency", "paymentId", "paymentSystem", "status", "tariffId", "transactionId", "url", "userId" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
