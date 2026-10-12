const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { verifyBackend } = require("../scripts/verify-cloud-run");

async function withServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try { await run("http://127.0.0.1:" + port); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test("verifies deep health and public collection APIs without writes", async () => {
  const paths = [];
  await withServer((req, res) => {
    paths.push(req.url);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(req.url === "/api/health?deep=1"
      ? { ok: true, status: "healthy", database: "up" }
      : { ok: true, data: [] }));
  }, baseUrl => verifyBackend(baseUrl, fetch));
  assert.deepEqual(paths, ["/api/health?deep=1", "/api/projects", "/api/certificates"]);
});

test("fails when Firestore health is degraded", async () => {
  await withServer((req, res) => {
    res.statusCode = 503;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, status: "degraded", database: "down" }));
  }, baseUrl => assert.rejects(verifyBackend(baseUrl, fetch), /deep health and Firestore connectivity check failed/));
});

test("fails on malformed public collection responses", async () => {
  await withServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, data: {} }));
  }, baseUrl => assert.rejects(verifyBackend(baseUrl, fetch), /public projects check failed/));
});

test("requires an HTTP service URL", async () => {
  await assert.rejects(verifyBackend("ftp://example.com", fetch), /must use http/);
});
