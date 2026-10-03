const test = require("node:test");
const assert = require("node:assert/strict");

const { mysqlDateTime } = require("../netlify/functions/admin-messages");

test("admin message timestamps are MySQL compatible", () => {
  const value = mysqlDateTime(new Date("2026-10-03T10:20:30.456Z"));
  assert.equal(value, "2026-10-03 10:20:30");
});
