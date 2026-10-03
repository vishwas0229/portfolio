import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";

const required = [
  "index.html",
  "robots.txt",
  "sitemap.xml",
  "netlify.toml",
  "netlify/functions/health.js",
  "netlify/functions/github.js",
  "netlify/functions/leetcode.js"
];

for (const file of required) await access(file);

const html = await readFile("index.html", "utf8");
const robots = await readFile("robots.txt", "utf8");
const sitemap = await readFile("sitemap.xml", "utf8");

const productionUrl = "https://portfolio.postlyfi.in";
if (!html.includes(`<link rel="canonical" href="${productionUrl}"`)) throw new Error("Canonical URL is not configured for production.");
if (!html.includes(`<meta property="og:url" content="${productionUrl}"`)) throw new Error("Open Graph URL is not configured for production.");
if (!robots.includes(`Sitemap: ${productionUrl}/sitemap.xml`)) throw new Error("robots.txt sitemap URL is invalid.");
if (!sitemap.includes(`<loc>${productionUrl}/</loc>`)) throw new Error("sitemap.xml does not contain the production URL.");
if ((html.match(/https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js/g) || []).length !== 1) {
  throw new Error("index.html must load the Cloudflare Insights beacon exactly once.");
}

console.log("Site validation passed.");
