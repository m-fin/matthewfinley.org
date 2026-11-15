export function initViews() {
  const slot = document.querySelector("[data-views]");
  const path = `${location.pathname}${location.search ? "" : ""}`;
  fetch(`/api/views?path=${encodeURIComponent(path)}`, { method: "POST" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (!slot || !data || data.views == null) return;
      slot.hidden = false;
      slot.textContent = data.views === 1 ? "1 view on this page" : `${data.views} views on this page`;
    })
    .catch(() => {});
}
