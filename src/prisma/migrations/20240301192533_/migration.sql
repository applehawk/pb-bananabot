/*
  Warnings:

  - The primary key for the `Connection` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `key_id` on the `Connection` table. All the data in the column will be lost.
  - You are about to drop the column `tgid` on the `Connection` table. All the data in the column will be lost.
  - You are about to drop the column `user_tgid` on the `Connection` table. All the data in the column will be lost.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `tgid` on the `User` table. All the data in the column will be lost.
  - Added the required column `id` to the `Connection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Payment" (
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
    "monthCount" INTEGER NOT NULL,
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

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Connection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "server_port" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "access_url" TEXT NOT NULL,
    "userId" INTEGER,
    CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Connection" ("access_url", "method", "name", "password", "server", "server_port") SELECT "access_url", "method", "name", "password", "server", "server_port" FROM "Connection";
DROP TABLE "Connection";
ALTER TABLE "new_Connection" RENAME TO "Connection";
CREATE TABLE "new_User" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chatId" INTEGER,
    "firstname" TEXT,
    "lastname" TEXT,
    "nickname" TEXT,
    "connLimit" INTEGER NOT NULL
);
INSERT INTO "new_User" ("chatId", "connLimit", "firstname", "lastname", "nickname") SELECT "chatId", "connLimit", "firstname", "lastname", "nickname" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
