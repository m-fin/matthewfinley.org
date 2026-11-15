import { bindingFlags, json } from "../_lib/server.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return json({ ok: false, error: "Use GET." }, 405);
  return json({ ok: true, ...bindingFlags(env) });
}
