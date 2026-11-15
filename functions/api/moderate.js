import { bearer, json, moderateGuestbook, readJson, safeEqual } from "../_lib/server.js";

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  const token = env.MODERATION_TOKEN || "";
  if (!token || !safeEqual(bearer(request), token)) {
    return json({ ok: false, error: "Moderator token required." }, 401);
  }
  const parsed = await readJson(request);
  if (parsed.error) return json({ ok: false, error: "Send JSON with an id." }, 400);
  const id = parsed.data.id;
  const approved = parsed.data.approved === true;
  if (id === undefined || id === null || String(id).length > 80) {
    return json({ ok: false, error: "Missing note id." }, 400);
  }
  if (!env.DB && !env.VIEWS) return json({ ok: false, error: "No guestbook storage is bound." }, 503);
  try {
    const changed = await moderateGuestbook(env, id, approved);
    if (!changed) return json({ ok: false, error: "That note was not found." }, 404);
    return json({ ok: true, approved });
  } catch (error) {
    console.error("moderation failed");
    return json({ ok: false, error: "Could not update that note." }, 500);
  }
}
