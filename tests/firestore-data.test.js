const test = require("node:test");
const assert = require("node:assert/strict");
const { parseQuery, prepareRecord } = require("../api/functions/_shared/db");

test("Firestore query parser maps filters, ordering and limits", () => {
  const parsed = parseQuery("projects", "?select=id,title&published=eq.true&display_order=gte.2&order=display_order.asc&limit=10");
  assert.deepEqual(parsed.columns, ["id", "title"]);
  assert.deepEqual(parsed.filters, [
    { field: "published", operator: "==", value: true },
    { field: "display_order", operator: ">=", value: 2 }
  ]);
  assert.deepEqual(parsed.orderBy, [{ field: "display_order", direction: "asc" }]);
  assert.equal(parsed.limit, 10);
});

test("Firestore query parser rejects unknown collection and fields", () => {
  assert.throws(() => parseQuery("secrets", ""), /Unsupported collection/);
  assert.throws(() => parseQuery("projects", "?unknown=eq.value"), /Unsupported query filter/);
});

test("Firestore records are assigned an id and structured JSON stays structured", () => {
  const row = prepareRecord("projects", { title: "Demo", tech_stack: ["Node", "Firestore"] });
  assert.ok(row.id);
  assert.deepEqual(row.tech_stack, ["Node", "Firestore"]);
  assert.ok(row.created_at);
  assert.ok(row.updated_at);
});
