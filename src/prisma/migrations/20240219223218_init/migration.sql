-- CreateTable
CREATE TABLE "User" (
    "key_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id" TEXT NOT NULL,
    "firstname" TEXT NOT NULL,
    "lastname" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "connLimit" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Connection" (
    "key_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tgid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "server_port" INTEGER NOT NULL,
    "password" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "access_url" TEXT NOT NULL,
    "userKey_id" INTEGER,
    CONSTRAINT "Connection_userKey_id_fkey" FOREIGN KEY ("userKey_id") REFERENCES "User" ("key_id") ON DELETE SET NULL ON UPDATE CASCADE
);
