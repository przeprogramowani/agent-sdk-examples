```diff
diff --git a/src/components/UserCard.tsx b/src/components/UserCard.tsx
index 3a1b2c4..9f8e7d6 100644
--- a/src/components/UserCard.tsx
+++ b/src/components/UserCard.tsx
@@ -1,24 +1,38 @@
-import React from "react";
+import React, { useState } from "react";
 
 interface UserCardProps {
   name: string;
   email: string;
   avatarUrl?: string;
+  onSelect?: (email: string) => void;
 }
 
-export function UserCard({ name, email, avatarUrl }: UserCardProps) {
+export function UserCard({ name, email, avatarUrl, onSelect }: UserCardProps) {
+  const [expanded, setExpanded] = useState(false);
+
+  const handleClick = () => {
+    setExpanded((prev) => !prev);
+    onSelect?.(email);
+  };
+
   return (
-    <div className="user-card">
-      <img src={avatarUrl} alt={name} />
-      <div className="user-card__body">
+    <div
+      className={`user-card ${expanded ? "user-card--expanded" : ""}`}
+      onClick={handleClick}
+      role="button"
+      tabIndex={0}
+    >
+      <img
+        src={avatarUrl ?? "/img/avatar-placeholder.png"}
+        alt={`Avatar of ${name}`}
+      />
+      <div className="user-card__body">
         <h3>{name}</h3>
-        <p>{email}</p>
+        {expanded && <p className="user-card__email">{email}</p>}
       </div>
     </div>
   );
 }
```
