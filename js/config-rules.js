const PLACEHOLDER = /^(todo|changeme|replace_me|your[_-].*|xxx+|0+)$/i;

export function isBlank(value) {
  if (typeof value !== "string") return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (PLACEHOLDER.test(trimmed)) return true;
  if (trimmed.toUpperCase().includes("TODO")) return true;
  return false;
}

export function isHttpsUrl(value) {
  if (isBlank(value)) return false;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return false;
    if (!url.hostname || url.hostname.includes("todo")) return false;
    return true;
  } catch (error) {
    return false;
  }
}

export function isBtcAddress(value) {
  if (isBlank(value)) return false;
  return /^(bc1[ac-hj-np-z02-9]{20,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(value.trim());
}

export function isEthAddress(value) {
  if (isBlank(value)) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function isSolAddress(value) {
  if (isBlank(value)) return false;
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
}

export function isLightning(value) {
  if (isBlank(value)) return false;
  const trimmed = value.trim();
  if (/^ln(bc|tb|bcrt)1[0-9a-z]{20,}$/i.test(trimmed)) return true;
  if (/^lightning:[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(trimmed)) return true;
  if (/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(trimmed)) return true;
  return false;
}

export function isPublisherId(value) {
  return typeof value === "string" && /^ca-pub-\d{10,20}$/.test(value.trim());
}

export function isAdSlotId(value) {
  return typeof value === "string" && /^\d{8,20}$/.test(value.trim());
}

export function isAnalyticsToken(value) {
  if (isBlank(value)) return false;
  return /^[A-Za-z0-9_-]{16,128}$/.test(value.trim());
}

export function isLiveSupport(entry) {
  if (!entry || entry.enabled !== true) return false;
  switch (entry.id) {
    case "bitcoin":
      return isBtcAddress(entry.address);
    case "lightning":
      return isLightning(entry.address || entry.url);
    case "ethereum":
      return isEthAddress(entry.address);
    case "solana":
      return isSolAddress(entry.address);
    default:
      return isHttpsUrl(entry.url);
  }
}

export function publicHandle(entry) {
  if (!entry || isBlank(entry.handle)) return "";
  return entry.handle.trim();
}

const CRYPTO_IDS = new Set(["bitcoin", "lightning", "ethereum", "solana"]);

export function isCrypto(entry) {
  return Boolean(entry && CRYPTO_IDS.has(entry.id));
}
