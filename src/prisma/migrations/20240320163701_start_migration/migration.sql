-- CreateTable
CREATE TABLE "User" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chatId" INTEGER,
    "firstname" TEXT,
    "lastname" TEXT,
    "username" TEXT,
    "connLimit" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hashId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "server_port" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "access_url" TEXT NOT NULL,
    "userId" INTEGER,
    CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);

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

-- CreateTable
CREATE TABLE "Tariff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "caption" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "BalanceChange" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "paymentId" TEXT,
    "balance" INTEGER NOT NULL,
    "changeAmount" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PAYMENT',
    "status" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "SceneStep" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scene" TEXT NOT NULL,
    "nextScene" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Tariff_id_key" ON "Tariff"("id");

-- CreateIndex
CREATE INDEX "Tariff_price_idx" ON "Tariff"("price");
