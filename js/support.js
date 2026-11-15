import { isCrypto, isLiveSupport, publicHandle } from "./config-rules.js";

const PAY_URI = {
  bitcoin: (address) => `bitcoin:${address}`,
  ethereum: (address) => `ethereum:${address}`,
  solana: (address) => `solana:${address}`,
  lightning: (address) => (address.startsWith("lightning:") ? address : address.includes("@") ? `lightning:${address}` : address),
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

async function qrSvg(payload) {
  if (!window.qrcode) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/js/qrcode.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("qr"));
      document.head.appendChild(script);
    });
  }
  const qr = window.qrcode(0, "M");
  qr.addData(payload);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

function disabledItem(entry) {
  const item = el("li");
  const card = el("div", "pay-disabled");
  card.append(el("span", "pay-name", entry.label || "Support"));
  card.append(el("span", "pay-state", "Not set up yet"));
  item.append(card);
  return item;
}

function linkItem(entry) {
  const item = el("li");
  const link = document.createElement("a");
  link.className = "pay";
  link.href = entry.url.trim();
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.append(el("span", "pay-name", entry.label));
  const handle = publicHandle(entry);
  link.append(el("span", "pay-state", handle || "Open"));
  const hidden = el("span", "visually-hidden", " (opens in a new tab)");
  link.append(hidden);
  item.append(link);
  return item;
}

async function cryptoCard(entry) {
  const card = el("article", "crypto-card");
  card.append(el("h3", null, entry.label));
  if (!isLiveSupport(entry)) {
    card.append(el("p", "pay-state", "Not set up yet"));
    return card;
  }
  const address = (entry.address || entry.url || "").trim();
  const payload = PAY_URI[entry.id](address);
  const code = el("p", "addr");
  code.textContent = address;
  card.append(code);
  const copy = el("button", "btn", "Copy");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(address);
      copy.textContent = "Copied";
    } catch (error) {
      copy.textContent = "Select the address to copy";
    }
  });
  card.append(copy);
  try {
    const holder = el("div", "qr");
    holder.innerHTML = await qrSvg(payload);
    const svg = holder.querySelector("svg");
    if (svg) {
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", `QR code for the ${entry.label} payment string`);
    }
    card.append(holder);
  } catch (error) {
    card.append(el("p", null, "QR code could not be drawn in this browser. The address above is still the one to use."));
  }
  return card;
}

export async function initSupport(config) {
  const roots = document.querySelectorAll("[data-support-root]");
  if (!roots.length) return;
  const entries = Array.isArray(config?.support) ? config.support : [];
  const links = entries.filter((entry) => !isCrypto(entry));
  const crypto = entries.filter((entry) => isCrypto(entry));
  const noteText = "A method stays off until its link or address is a real one. Placeholder values are not published as buttons.";
  for (const root of roots) {
    const list = el("ul", "pay-grid");
    links.forEach((entry) => list.append(isLiveSupport(entry) ? linkItem(entry) : disabledItem(entry)));
    const grid = el("div", "crypto-grid");
    for (const entry of crypto) grid.append(await cryptoCard(entry));
    root.replaceChildren(list, grid, el("p", null, noteText));
  }
}
