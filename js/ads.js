import { isAdSlotId, isPublisherId } from "./config-rules.js";

let scriptPromise = null;

function loadAdsScript(publisherId) {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("adsense"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export async function initAds(config) {
  const publisherId = config?.adsense?.publisherId || "";
  if (!isPublisherId(publisherId)) return;
  const slots = config.adsense.slots || {};
  const frames = [...document.querySelectorAll("[data-ad-placement]")].filter((slot) => {
    return isAdSlotId(slots[slot.getAttribute("data-ad-placement")]);
  });
  if (!frames.length) return;
  try {
    await loadAdsScript(publisherId);
  } catch (error) {
    return;
  }
  frames.forEach((slot) => {
    const placement = slot.getAttribute("data-ad-placement");
    const frame = slot.querySelector(".ad-frame");
    if (!frame) return;
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.dataset.adClient = publisherId;
    ins.dataset.adSlot = slots[placement];
    ins.dataset.adFormat = "auto";
    ins.dataset.fullWidthResponsive = "true";
    frame.replaceChildren(ins);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      frame.replaceChildren();
    }
  });
}
