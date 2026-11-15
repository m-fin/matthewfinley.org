import { json } from "../_lib/server.js";

function cleanPath(value) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("..")) return "/";
  if (value.length > 200 || value.startsWith("/api/")) return "/";
  return value;
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ ok: false, error: "Use GET or POST." }, 405);
  }
  const path = cleanPath(new URL(request.url).searchParams.get("path") || "/");
  if (!env.VIEWS) return json({ configured: false, path, views: null, total: null });
  const key = `views:path:${path}`;
  let views = Number((await env.VIEWS.get(key)) || 0);
  let total = Number((await env.VIEWS.get("views:total")) || 0);
  if (!Number.isFinite(views)) views = 0;
  if (!Number.isFinite(total)) total = 0;
  if (request.method === "POST") {
    views += 1;
    total += 1;
    await env.VIEWS.put(key, String(views));
    await env.VIEWS.put("views:total", String(total));
  }
  return json({ configured: true, path, views, total });
}
