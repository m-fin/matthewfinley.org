import { initAds } from "./ads.js";
import { initAnalytics } from "./analytics.js";
import { initContact } from "./contact.js";
import { initProjects } from "./projects.js";
import { initSupport } from "./support.js";
import { initViews } from "./views.js";

function syncSpotifyEmbeds(theme) {
  document.querySelectorAll("iframe[data-spotify-embed]").forEach((frame) => {
    const base = frame.getAttribute("data-spotify-embed");
    if (!base) return;
    const next = new URL(base);
    next.searchParams.set("theme", theme === "light" ? "1" : "0");
    if (frame.getAttribute("src") !== next.href) frame.setAttribute("src", next.href);
  });
}

function syncThemeButton() {
  const button = document.querySelector("#theme-toggle");
  const theme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  syncSpotifyEmbeds(theme);
  if (!button) return;
  const next = theme === "light" ? "dark" : "light";
  button.textContent = next === "light" ? "Light theme" : "Dark theme";
  button.setAttribute("aria-label", `Switch to ${next} theme`);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f6f1e4" : "#10140f");
}

function initTheme() {
  const button = document.querySelector("#theme-toggle");
  syncThemeButton();
  button?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("mf-theme", next);
    } catch (error) {
      /* storage can be blocked */
    }
    syncThemeButton();
  });
}

function initConsent(config) {
  const banner = document.querySelector("#cookie-notice");
  if (!banner) return;
  const show = () => {
    banner.hidden = false;
    document.body.classList.add("has-banner");
  };
  const hide = () => {
    banner.hidden = true;
    document.body.classList.remove("has-banner");
  };
  let choice = "";
  try {
    choice = localStorage.getItem("mf-consent") || "";
  } catch (error) {
    choice = "";
  }
  if (choice === "accepted") initAds(config);
  else if (choice !== "rejected") show();

  banner.querySelector("[data-consent='accepted']")?.addEventListener("click", () => {
    try { localStorage.setItem("mf-consent", "accepted"); } catch (error) { /* ignore */ }
    hide();
    initAds(config);
  });
  banner.querySelector("[data-consent='rejected']")?.addEventListener("click", () => {
    try { localStorage.setItem("mf-consent", "rejected"); } catch (error) { /* ignore */ }
    hide();
  });
}

async function loadConfig() {
  const response = await fetch("/config/site.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("config");
  return response.json();
}

function initNav() {
  const button = document.querySelector("#nav-toggle");
  const nav = document.querySelector("#site-nav");
  if (!button || !nav) return;
  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
  };
  button.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
}

initTheme();
initNav();
initViews();
initProjects();
initContact();

loadConfig()
  .then((config) => {
    initAnalytics(config);
    initSupport(config);
    initConsent(config);
  })
  .catch(() => {
    initConsent(null);
  });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
