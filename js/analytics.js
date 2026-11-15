import { isAnalyticsToken } from "./config-rules.js";

export function initAnalytics(config) {
  const token = config?.analytics?.token || "";
  if (!isAnalyticsToken(token)) return;
  if (document.querySelector("script[data-cf-beacon]")) return;
  const script = document.createElement("script");
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.setAttribute("data-cf-beacon", JSON.stringify({ token: token.trim() }));
  document.body.appendChild(script);
}
