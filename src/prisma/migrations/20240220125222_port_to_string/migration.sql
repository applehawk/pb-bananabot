-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Connection" (
    "key_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tgid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "server_port" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "access_url" TEXT NOT NULL,
    "userKey_id" INTEGER,
    CONSTRAINT "Connection_userKey_id_fkey" FOREIGN KEY ("userKey_id") REFERENCES "User" ("key_id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Connection" ("access_url", "key_id", "method", "name", "password", "server", "server_port", "tgid", "userKey_id") SELECT "access_url", "key_id", "method", "name", "password", "server", "server_port", "tgid", "userKey_id" FROM "Connection";
DROP TABLE "Connection";
ALTER TABLE "new_Connection" RENAME TO "Connection";
CREATE TABLE "new_User" (
    "key_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id" TEXT NOT NULL,
    "firstname" TEXT,
    "lastname" TEXT,
    "nickname" TEXT,
    "connLimit" INTEGER NOT NULL
);
INSERT INTO "new_User" ("connLimit", "firstname", "id", "key_id", "lastname", "nickname") SELECT "connLimit", "firstname", "id", "key_id", "lastname", "nickname" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
