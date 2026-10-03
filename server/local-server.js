const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const FUNCTIONS = path.join(ROOT, "netlify", "functions");
const PORT = Number(process.env.PORT || 8888);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_BODY = 64 * 1024;

const ROUTES = {
  health: "health",
  contact: "contact",
  analytics: "analytics",
  projects: "projects",
  certificates: "certificates",
  "admin/login": "admin-login",
  "admin/logout": "admin-logout",
  "admin/session": "admin-session",
  "admin/account": "admin-account",
  "admin/messages": "admin-messages",
  "admin/analytics": "admin-analytics"
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function route(pathname) {
  if (!pathname.startsWith("/api/")) return null;
  let value = pathname.slice(5).replace(/^\/+|\/+$/g, "");
  for (const [prefix, fn] of Object.entries(ROUTES)) {
    if (value === prefix || value.startsWith(prefix + "/")) {
      const rest = value.slice(prefix.length).replace(/^\/+/, "");
      return { fn, rest };
    }
  }
  return null;
}

async function readBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Payload too large"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function setResponse(res, result) {
  const headers = { ...(result.headers || {}) };
  const cookies = result.multiValueHeaders?.["set-cookie"] || headers["set-cookie"];
  delete headers["set-cookie"];

  if (Array.isArray(cookies) && cookies.length) {
    res.setHeader("Set-Cookie", cookies);
  }

  res.writeHead(result.statusCode || 200, headers);
  res.end(result.body || "");
}

async function handleFunction(req, res, url, match) {
  const mod = require(path.join(FUNCTIONS, match.fn + ".js"));
  const body = ["GET","HEAD"].includes(req.method || "GET") ? "" : await readBody(req);

  const event = {
    httpMethod: req.method || "GET",
    path: url.pathname,
    headers: Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value.join(",") : String(value || "")])),
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    body,
    isBase64Encoded: false
  };

  const result = await mod.handler(event, {});
  setResponse(res, result);
}

function staticFilePath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch (_) { return null; }
  const clean = decoded === "/" ? "/index.html" : decoded;
  const target = path.resolve(ROOT, "." + clean);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return null;

  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    const index = path.join(target, "index.html");
    return fs.existsSync(index) ? index : null;
  }
  return fs.existsSync(target) && fs.statSync(target).isFile() ? target : null;
}

async function handleStatic(req, res, url) {
  const target = staticFilePath(url.pathname);
  if (!target) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }

  const stream = fs.createReadStream(target);
  stream.on("error", () => {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Internal Server Error");
  });

  res.writeHead(200, {
    "content-type": MIME[path.extname(target).toLowerCase()] || "application/octet-stream",
    "cache-control": target.endsWith(".html") ? "no-cache" : "public, max-age=3600"
  });
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://" + (req.headers.host || "localhost"));
    const apiRoute = route(url.pathname);

    if (apiRoute) {
      await handleFunction(req, res, url, apiRoute);
      return;
    }

    await handleStatic(req, res, url);
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    console.error("[local-server] request failed", {
      method: req.method,
      path: req.url,
      statusCode,
      code: error?.code,
      message: error?.message
    });
    if (!res.headersSent) {
      res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
    }
    res.end(JSON.stringify({
      ok: false,
      error: statusCode === 413 ? "Payload too large." : "Local server error."
    }));
  }
});

server.listen(PORT, HOST, () => {
  console.log("Rahul Portfolio Docker server listening on http://" + HOST + ":" + PORT);
});
