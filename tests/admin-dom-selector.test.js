const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("admin JavaScript does not pass CSS ID selectors to the ID-only helper", () => {
  const source = fs.readFileSync("admin/admin.js", "utf8");
  assert.doesNotMatch(source, /\$\("#/);
  assert.doesNotMatch(source, /\$\('#/);
});

test("admin login form controls use valid IDs", () => {
  const source = fs.readFileSync("admin/admin.js", "utf8");
  assert.match(source, /\$\("loginEmail"\)/);
  assert.match(source, /\$\("loginPassword"\)/);
  assert.match(source, /\$\("loginStatus"\)/);
});
