import {
  addGuestbook,
  bearer,
  cleanText,
  hashValue,
  json,
  listGuestbook,
  rateLimit,
  readJson,
  safeEqual,
  verifyTurnstile,
} from "../_lib/server.js";

export async function onRequest(context) {
  const method = context.request.method;
  if (method === "GET") return list(context);
  if (method === "POST") return create(context);
  return json({ ok: false, error: "Use GET or POST." }, 405);
}

async function list({ request, env }) {
  const scope = new URL(request.url).searchParams.get("scope") === "pending" ? "pending" : "public";
  if (scope === "pending") {
    const token = env.MODERATION_TOKEN || "";
    if (!token || !safeEqual(bearer(request), token)) {
      return json({ ok: false, error: "Moderator token required." }, 401);
    }
  }
  try {
    const notes = await listGuestbook(env, scope);
    if (notes === null) return json({ ok: true, configured: false, notes: [] });
    return json({
      ok: true,
      configured: true,
      notes: notes.map((note) => ({
        id: note.id,
        name: note.name,
        message: note.message,
        createdAt: note.created_at,
      })),
    });
  } catch (error) {
    console.error("guestbook list failed");
    return json({ ok: false, error: "The guestbook could not be read." }, 500);
  }
}

async function create({ request, env }) {
  const parsed = await readJson(request);
  if (parsed.error === "too-large") return json({ ok: false, error: "That note is too large." }, 413);
  if (parsed.error) return json({ ok: false, error: "Send the form as JSON." }, 415);
  const body = parsed.data;
  if (typeof body.company === "string" && body.company.trim()) {
    return json({ ok: true, queued: true });
  }
  const name = cleanText(body.name, 80);
  const message = cleanText(body.message, 1000);
  if (name.length < 1 || message.length < 2) {
    return json({ ok: false, error: "Add a name and a note." }, 400);
  }
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const turnstile = await verifyTurnstile(env, body.turnstileToken, ip);
  if (turnstile.code === "unconfigured") {
    return json({ ok: false, error: "The guestbook is not configured yet." }, 503);
  }
  if (!turnstile.ok) return json({ ok: false, error: "The spam check failed. Try again." }, 400);
  const ipHash = await hashValue(`${env.RATE_LIMIT_SALT || "matthewfinley.org"}|${ip || "unknown"}`);
  if (!(await rateLimit(env, `guestbook:${ipHash}`))) {
    return json({ ok: false, error: "Too many notes. Try again later." }, 429);
  }
  if (!env.DB && !env.VIEWS) {
    return json({ ok: false, error: "The guestbook has no database binding yet." }, 503);
  }
  try {
    const saved = await addGuestbook(env, { name, message, createdAt: new Date().toISOString() });
    if (!saved) return json({ ok: false, error: "The note could not be saved." }, 500);
    return json({ ok: true, queued: true });
  } catch (error) {
    console.error("guestbook write failed");
    return json({ ok: false, error: "The note could not be saved." }, 500);
  }
}
