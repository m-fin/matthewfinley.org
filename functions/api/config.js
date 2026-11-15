import { json, publicConfig } from "../_lib/server.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return json({ ok: false, error: "Use GET." }, 405);
  return json(publicConfig(env));
}
