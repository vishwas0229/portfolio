const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("admin login uses a real DOM query for the submit button", () => {
  const source = fs.readFileSync("admin/admin.js", "utf8");
  assert.doesNotMatch(source, /\$\(['"]#loginForm button\[type=["']submit["']\]\)/);
  assert.match(source, /document\.querySelector\(['"]#loginForm button\[type=["']submit["']\]['"]\)/);
});
