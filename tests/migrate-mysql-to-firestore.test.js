const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeRow, TABLES } = require("../scripts/migrate-mysql-to-firestore");

test("normalizes JSON, booleans, numeric fields, dates and IDs", () => {
  const row = normalizeRow("projects", {
    id: "p1", tech_stack: "[\"Node\",\"Firestore\"]",
    featured: 1, published: 0, display_order: "4",
    created_at: new Date("2026-01-01T00:00:00.000Z")
  });
  assert.equal(row.id, "p1");
  assert.deepEqual(row.tech_stack, ["Node", "Firestore"]);
  assert.equal(row.featured, true);
  assert.equal(row.published, false);
  assert.equal(row.display_order, 4);
  assert.equal(row.created_at, "2026-01-01T00:00:00.000Z");
});

test("rejects unsupported collections and missing IDs", () => {
  assert.throws(() => normalizeRow("unknown", {}), /Unsupported table/);
  assert.throws(() => normalizeRow("admins", { email: "admin@example.com" }), /primary id/);
});

test("migration allowlist includes all existing logical tables", () => {
  assert.deepEqual(Object.keys(TABLES), ["projects", "certificates", "contact_messages", "analytics_events", "admins"]);
});
