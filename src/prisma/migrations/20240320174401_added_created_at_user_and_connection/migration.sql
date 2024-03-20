-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Connection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hashId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "server_port" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "access_url" TEXT NOT NULL,
    "userId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Connection" ("access_url", "hashId", "id", "method", "name", "password", "server", "server_port", "userId") SELECT "access_url", "hashId", "id", "method", "name", "password", "server", "server_port", "userId" FROM "Connection";
DROP TABLE "Connection";
ALTER TABLE "new_Connection" RENAME TO "Connection";
CREATE TABLE "new_User" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chatId" INTEGER,
    "firstname" TEXT,
    "lastname" TEXT,
    "username" TEXT,
    "connLimit" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("balance", "chatId", "connLimit", "firstname", "lastname", "userId", "username") SELECT "balance", "chatId", "connLimit", "firstname", "lastname", "userId", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
