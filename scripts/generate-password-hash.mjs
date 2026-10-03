import crypto from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error("Usage: node scripts/generate-password-hash.mjs '<password>'");
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("base64url");
const iterations = 210000;
const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
console.log("pbkdf2$sha256$" + iterations + "$" + salt + "$" + hash);
