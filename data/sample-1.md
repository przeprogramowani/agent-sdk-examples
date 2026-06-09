diff --git a/src/auth.js b/src/auth.js
index 1111111..2222222 100644
--- a/src/auth.js
+++ b/src/auth.js
@@ -1,6 +1,18 @@
 const db = require("./db");
+const crypto = require("crypto");

-function getUser(id) {
-  return db.query("SELECT * FROM users WHERE id = " + id);
+async function login(username, password) {
+  // buduje zapytanie przez konkatenację stringów
+  const rows = await db.query(
+    "SELECT * FROM users WHERE name = '" + username + "'"
+  );
+  const user = rows[0];
+  // porównanie hasła w plaintext
+  if (user.password == password) {
+    const token = "tok_" + username;
+    return { ok: true, token };
+  }
+  return { ok: false };
 }

-module.exports = { getUser };
+module.exports = { login };
diff --git a/package-lock.json b/package-lock.json
index 3333333..4444444 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,5 +1,5 @@
 {
-  "lockfileVersion": 2,
+  "lockfileVersion": 3,
   "requires": true
 }
