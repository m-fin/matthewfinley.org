import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isAnalyticsToken, isLiveSupport, isPublisherId } from "../js/config-rules.js";
import { onRequest as contact } from "../functions/api/contact.js";
import { onRequest as guestbook } from "../functions/api/guestbook.js";
import { onRequest as health } from "../functions/api/health.js";
import { onRequest as moderate } from "../functions/api/moderate.js";
import { onRequest as publicConfig } from "../functions/api/config.js";
import { onRequest as views } from "../functions/api/views.js";
import { cleanText, safeEqual } from "../functions/_lib/server.js";

const root = fileURLToPath(new URL("..", import.meta.url));

function memoryKv() {
  const map = new Map();
  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value) {
      map.set(key, String(value));
    },
    map,
  };
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

test("support config stays disabled and unpublished", () => {
  const config = JSON.parse(readFileSync(join(root, "config/site.json"), "utf8"));
  assert.equal(config.adsense.publisherId, "");
  assert.equal(isPublisherId(config.adsense.publisherId), false);
  assert.equal(config.analytics.token, "");
  assert.equal(isAnalyticsToken(config.analytics.token), false);
  for (const entry of config.support) {
    assert.equal(entry.enabled, false);
    assert.equal(isLiveSupport(entry), false);
  }
  assert.equal(config.support.some((entry) => entry.id === "lightning"), true);
  assert.equal(config.support.some((entry) => entry.id === "xmoney"), true);
});

test("cleanText keeps paragraphs and drops control bytes", () => {
  assert.equal(cleanText("a\nb\u0000c", 20), "a\nbc");
  assert.equal(safeEqual("same", "same"), true);
  assert.equal(safeEqual("same", "same "), false);
  assert.equal(safeEqual("", ""), false);
});

test("contact form refuses work without Turnstile", async () => {
  const response = await contact({
    request: new Request("https://matthewfinley.org/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Ada", email: "ada@example.com", message: "Hello there" }),
    }),
    env: {},
  });
  assert.equal(response.status, 503);
});

test("contact form stores in KV after Turnstile and ignores the honeypot", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("siteverify")) {
      return new Response(JSON.stringify({ success: true }), { headers: { "content-type": "application/json" } });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const kv = memoryKv();
    const env = { TURNSTILE_SECRET_KEY: "test-secret", TURNSTILE_SITE_KEY: "test-site", VIEWS: kv };
    const honeypot = await contact({
      request: new Request("https://matthewfinley.org/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Bot", email: "bot@example.com", message: "buy now", company: "spam", turnstileToken: "x".repeat(20) }),
      }),
      env,
    });
    assert.equal(honeypot.status, 200);
    assert.equal(kv.map.size, 0);

    const saved = await contact({
      request: new Request("https://matthewfinley.org/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Ada", email: "ada@example.com", message: "Hello there", turnstileToken: "x".repeat(20) }),
      }),
      env,
    });
    assert.equal(saved.status, 200);
    const body = await saved.json();
    assert.equal(body.stored, true);
    assert.equal(body.forwarded, false);
    assert.equal([...kv.map.keys()].some((key) => key.startsWith("contact:")), true);
  } finally {
    globalThis.fetch = original;
  }
});

test("guestbook hides notes until moderation", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true }), { headers: { "content-type": "application/json" } });
  try {
    const kv = memoryKv();
    const env = { TURNSTILE_SECRET_KEY: "s", TURNSTILE_SITE_KEY: "k", VIEWS: kv, MODERATION_TOKEN: "mod-token-value" };
    const created = await guestbook({
      request: new Request("https://matthewfinley.org/api/guestbook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Sam", message: "Nice site", turnstileToken: "x".repeat(20) }),
      }),
      env,
    });
    assert.equal(created.status, 200);
    const pub = await guestbook({ request: new Request("https://matthewfinley.org/api/guestbook"), env });
    const pubBody = await pub.json();
    assert.deepEqual(pubBody.notes, []);
    const denied = await guestbook({ request: new Request("https://matthewfinley.org/api/guestbook?scope=pending"), env });
    assert.equal(denied.status, 401);
    const pending = await guestbook({
      request: new Request("https://matthewfinley.org/api/guestbook?scope=pending", {
        headers: { authorization: "Bearer mod-token-value" },
      }),
      env,
    });
    const pendingBody = await pending.json();
    assert.equal(pendingBody.notes.length, 1);
    const updated = await moderate({
      request: new Request("https://matthewfinley.org/api/moderate", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer mod-token-value" },
        body: JSON.stringify({ id: pendingBody.notes[0].id, approved: true }),
      }),
      env,
    });
    assert.equal(updated.status, 200);
    const after = await guestbook({ request: new Request("https://matthewfinley.org/api/guestbook"), env });
    const afterBody = await after.json();
    assert.equal(afterBody.notes[0].message, "Nice site");
  } finally {
    globalThis.fetch = original;
  }
});

test("views count and public config hide a swapped secret", async () => {
  const kv = memoryKv();
  const first = await views({
    request: new Request("https://matthewfinley.org/api/views?path=/about/"),
    env: { VIEWS: kv },
  });
  assert.equal((await first.json()).views, 0);
  const second = await views({
    request: new Request("https://matthewfinley.org/api/views?path=/about/", { method: "POST" }),
    env: { VIEWS: kv },
  });
  assert.equal((await second.json()).views, 1);
  const config = await publicConfig({
    request: new Request("https://matthewfinley.org/api/config"),
    env: { TURNSTILE_SITE_KEY: "same-value", TURNSTILE_SECRET_KEY: "same-value" },
  });
  assert.equal((await config.json()).turnstileSiteKey, "");
  const flags = await health({ request: new Request("https://matthewfinley.org/api/health"), env: { VIEWS: kv } });
  const healthBody = await flags.json();
  assert.equal(healthBody.kv, true);
  assert.equal(healthBody.turnstile, false);
});

test("generated site has no personal contact leaks or live ad code", () => {
  const required = [
    "index.html",
    "about/index.html",
    "projects/index.html",
    "music/index.html",
    "videos/index.html",
    "blog/index.html",
    "support/index.html",
    "contact/index.html",
    "links/index.html",
    "privacy/index.html",
    "404.html",
    "sitemap.xml",
    "feed.xml",
    "ads.txt",
    "robots.txt",
  ];
  for (const file of required) assert.equal(statSync(join(root, file)).isFile(), true, file);
  const phone = /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/;
  const files = walk(root).filter((path) => !path.includes(`${join("tests")}`));
  for (const path of files) {
    if (!/\.(html|css|js|json|txt|xml|md|toml)$/.test(path)) continue;
    const text = readFileSync(path, "utf8");
    assert.equal(text.includes("live.unc.edu"), false, path);
    assert.equal(text.toLowerCase().includes("gmail.com"), false, path);
    assert.equal(text.includes("BEGIN PGP"), false, path);
    assert.equal(phone.test(text), false, path);
    if (!path.includes("/legacy/")) {
      assert.equal(text.includes("zoom.us"), false, path);
    }
  }
  const home = readFileSync(join(root, "index.html"), "utf8");
  assert.equal(home.includes("adsbygoogle.js"), false);
  assert.equal(home.includes("ca-pub-"), false);
  assert.match(home, /hello@matthewfinley.org/);
  assert.match(home, /Not set up yet/);
  const ads = readFileSync(join(root, "ads.txt"), "utf8");
  assert.equal(ads.includes("google.com,"), false);
  const headers = readFileSync(join(root, "_headers"), "utf8");
  assert.match(headers, /googlesyndication\.com/);
  assert.match(headers, /challenges\.cloudflare\.com/);
  assert.match(readFileSync(join(root, "sitemap.xml"), "utf8"), /https:\/\/matthewfinley\.org\/about\//);
  assert.match(readFileSync(join(root, "feed.xml"), "utf8"), /what-im-making/);
  assert.match(readFileSync(join(root, "music/index.html"), "utf8"), /soundcloud\.com\/sonicrift/);
  assert.equal((readFileSync(join(root, "music/index.html"), "utf8").match(/<h1>[^<]*Sonicrift/)), null);
});
