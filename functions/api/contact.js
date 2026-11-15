import {
  cleanText,
  forwardContact,
  hashValue,
  isEmail,
  json,
  rateLimit,
  readJson,
  storeContact,
  verifyTurnstile,
} from "../_lib/server.js";

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  const parsed = await readJson(request);
  if (parsed.error === "too-large") return json({ ok: false, error: "That message is too large." }, 413);
  if (parsed.error) return json({ ok: false, error: "Send the form as JSON." }, 415);

  const body = parsed.data;
  if (typeof body.company === "string" && body.company.trim()) {
    return json({ ok: true, stored: true, forwarded: false });
  }

  const name = cleanText(body.name, 80);
  const email = cleanText(body.email, 200);
  const message = cleanText(body.message, 4000);
  if (name.length < 1 || message.length < 4 || !isEmail(email)) {
    return json({ ok: false, error: "Add a name, a real email, and a short message." }, 400);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "";
  const turnstile = await verifyTurnstile(env, body.turnstileToken, ip);
  if (turnstile.code === "unconfigured") {
    return json({
      ok: false,
      error: "The form is not configured yet. Email hello@matthewfinley.org.",
    }, 503);
  }
  if (!turnstile.ok) return json({ ok: false, error: "The spam check failed. Try again." }, 400);

  const ipHash = await hashValue(`${env.RATE_LIMIT_SALT || "matthewfinley.org"}|${ip || "unknown"}`);
  if (!(await rateLimit(env, `contact:${ipHash}`))) {
    return json({ ok: false, error: "Too many messages. Email hello@matthewfinley.org instead." }, 429);
  }

  const createdAt = new Date().toISOString();
  let forwarded = false;
  try {
    forwarded = await forwardContact(env, { name, email, message, createdAt });
  } catch (error) {
    console.error("contact forward failed");
  }

  let stored = "";
  try {
    stored = await storeContact(env, {
      name,
      email,
      message,
      createdAt,
      forwardStatus: forwarded ? "sent" : "stored",
    });
  } catch (error) {
    console.error("contact store failed");
  }

  if (!stored && !forwarded) {
    return json({
      ok: false,
      error: "The message could not be saved. Email hello@matthewfinley.org.",
    }, 500);
  }
  return json({ ok: true, stored: Boolean(stored), forwarded, storage: stored || null });
}
