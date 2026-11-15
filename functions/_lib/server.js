export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function readJson(request, maxBytes = 20000) {
  const advertised = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(advertised) && advertised > maxBytes) return { error: "too-large" };
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("application/json")) return { error: "type" };
  const text = await request.text();
  if (text.length > maxBytes) return { error: "too-large" };
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) return { error: "json" };
    return { data };
  } catch (error) {
    return { error: "json" };
  }
}

export function cleanText(value, max) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
}

export function isEmail(value) {
  if (typeof value !== "string") return false;
  if (value.length > 200 || /[\r\n]/.test(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (!a || !b || a.length !== b.length) return false;
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

export function bearer(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : "";
}

export async function hashValue(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export async function verifyTurnstile(env, token, ip) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, code: "unconfigured" };
  if (typeof token !== "string" || token.length < 10 || token.length > 4096) {
    return { ok: false, code: "missing" };
  }
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) return { ok: false, code: "verify-failed" };
    const data = await response.json();
    return { ok: data.success === true, code: data.success ? "ok" : "rejected" };
  } catch (error) {
    return { ok: false, code: "verify-failed" };
  }
}

export async function rateLimit(env, bucket, limit = 5) {
  if (!env.VIEWS) return true;
  const hour = new Date().toISOString().slice(0, 13);
  const key = `rate:${bucket}:${hour}`;
  try {
    const current = Number((await env.VIEWS.get(key)) || 0);
    if (current >= limit) return false;
    await env.VIEWS.put(key, String(current + 1), { expirationTtl: 7200 });
    return true;
  } catch (error) {
    console.error("rate limit skipped");
    return true;
  }
}

let schemaReady = null;

export function ensureSchema(db) {
  if (!schemaReady) {
    schemaReady = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS guestbook (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL,
        approved INTEGER NOT NULL DEFAULT 0
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS contact_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL,
        forward_status TEXT
      )`),
    ]).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function storeContact(env, record) {
  if (env.DB) {
    await ensureSchema(env.DB);
    await env.DB.prepare(
      "INSERT INTO contact_messages (name, email, message, created_at, forward_status) VALUES (?, ?, ?, ?, ?)",
    ).bind(record.name, record.email, record.message, record.createdAt, record.forwardStatus || "stored").run();
    return "d1";
  }
  if (env.VIEWS) {
    const key = `contact:${record.createdAt}:${crypto.randomUUID()}`;
    await env.VIEWS.put(key, JSON.stringify({
      name: record.name,
      email: record.email,
      message: record.message,
      createdAt: record.createdAt,
    }));
    return "kv";
  }
  return "";
}

async function readKvGuestbook(kv) {
  const raw = await kv.get("guestbook:records");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

export async function addGuestbook(env, record) {
  const entry = {
    id: crypto.randomUUID(),
    name: record.name,
    message: record.message,
    created_at: record.createdAt,
    approved: 0,
  };
  if (env.DB) {
    await ensureSchema(env.DB);
    const result = await env.DB.prepare(
      "INSERT INTO guestbook (name, message, created_at, approved) VALUES (?, ?, ?, 0)",
    ).bind(record.name, record.message, record.createdAt).run();
    return { ...entry, id: result.meta?.last_row_id || entry.id, storage: "d1" };
  }
  if (env.VIEWS) {
    const items = await readKvGuestbook(env.VIEWS);
    items.push(entry);
    const trimmed = items.slice(-500);
    await env.VIEWS.put("guestbook:records", JSON.stringify(trimmed));
    return { ...entry, storage: "kv" };
  }
  return null;
}

export async function listGuestbook(env, scope) {
  const approved = scope === "pending" ? 0 : 1;
  if (env.DB) {
    await ensureSchema(env.DB);
    const { results } = await env.DB.prepare(
      "SELECT id, name, message, created_at, approved FROM guestbook WHERE approved = ? ORDER BY id DESC LIMIT 50",
    ).bind(approved).all();
    return results || [];
  }
  if (env.VIEWS) {
    const items = await readKvGuestbook(env.VIEWS);
    return items.filter((item) => Number(item.approved) === approved).slice(-50).reverse();
  }
  return null;
}

export async function moderateGuestbook(env, id, approved) {
  const next = approved ? 1 : 2;
  if (env.DB) {
    await ensureSchema(env.DB);
    const result = await env.DB.prepare("UPDATE guestbook SET approved = ? WHERE id = ?").bind(next, id).run();
    return (result.meta?.changes || 0) > 0;
  }
  if (env.VIEWS) {
    const items = await readKvGuestbook(env.VIEWS);
    const item = items.find((entry) => String(entry.id) === String(id));
    if (!item) return false;
    item.approved = next;
    await env.VIEWS.put("guestbook:records", JSON.stringify(items));
    return true;
  }
  return false;
}

function encodeHeader(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

export function buildRawEmail({ from, to, replyTo, subject, text }) {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
  ];
  if (replyTo) lines.push(`Reply-To: ${replyTo}`);
  return `${lines.join("\r\n")}\r\n\r\n${text.replace(/\r?\n/g, "\r\n")}\r\n`;
}

export async function forwardContact(env, record) {
  const to = env.CONTACT_TO || "hello@matthewfinley.org";
  const from = env.CONTACT_FROM || "hello@matthewfinley.org";
  if (!isEmail(to) || !isEmail(from)) return false;
  const subject = `Website note from ${record.name}`;
  const text = [
    "A note arrived from matthewfinley.org.",
    "",
    `Name: ${record.name}`,
    `Email: ${record.email}`,
    "",
    record.message,
  ].join("\n");

  if (env.EMAIL && typeof env.EMAIL.send === "function") {
    try {
      const { EmailMessage } = await import("cloudflare:email");
      const raw = buildRawEmail({ from, to, replyTo: record.email, subject, text });
      await env.EMAIL.send(new EmailMessage(from, to, raw));
      return true;
    } catch (error) {
      console.error("email binding failed");
    }
  }

  if (env.MAIL_PROVIDER === "mailchannels") {
    const response = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to, name: "Matthew Finley" }] }],
        from: { email: from, name: "matthewfinley.org" },
        reply_to: { email: record.email, name: record.name },
        subject,
        content: [{ type: "text/plain", value: text }],
      }),
    });
    return response.ok;
  }
  return false;
}

export function publicConfig(env) {
  const siteKey = typeof env.TURNSTILE_SITE_KEY === "string" ? env.TURNSTILE_SITE_KEY.trim() : "";
  const secret = typeof env.TURNSTILE_SECRET_KEY === "string" ? env.TURNSTILE_SECRET_KEY : "";
  return {
    turnstileSiteKey: siteKey && siteKey !== secret ? siteKey : "",
  };
}

export function bindingFlags(env) {
  return {
    turnstile: Boolean(env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY),
    d1: Boolean(env.DB),
    kv: Boolean(env.VIEWS),
    email: Boolean(env.EMAIL),
    mailchannels: env.MAIL_PROVIDER === "mailchannels",
    moderation: Boolean(env.MODERATION_TOKEN),
  };
}
