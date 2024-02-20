-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "key_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id" TEXT NOT NULL,
    "firstname" TEXT NOT NULL,
    "lastname" TEXT,
    "nickname" TEXT,
    "connLimit" INTEGER NOT NULL
);
INSERT INTO "new_User" ("connLimit", "firstname", "id", "key_id", "lastname", "nickname") SELECT "connLimit", "firstname", "id", "key_id", "lastname", "nickname" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
