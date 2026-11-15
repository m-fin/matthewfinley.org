let turnstileReady = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (turnstileReady) return turnstileReady;
  turnstileReady = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile"));
    document.head.appendChild(script);
  });
  return turnstileReady;
}

function setStatus(node, kind, message) {
  if (!node) return;
  node.dataset.kind = kind || "";
  node.textContent = message || "";
}

async function postJson(url, payload, token) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function renderNotes(list, notes) {
  list.replaceChildren();
  if (!notes.length) {
    list.append(Object.assign(document.createElement("li"), { textContent: "No public notes yet." }));
    return;
  }
  notes.forEach((note) => {
    const item = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = note.name;
    item.append(name);
    const time = document.createElement("time");
    time.dateTime = note.createdAt || "";
    time.textContent = note.createdAt ? ` · ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(note.createdAt))}` : "";
    item.append(time);
    const message = document.createElement("p");
    message.textContent = note.message;
    item.append(message);
    list.append(item);
  });
}

async function mountWidget(container, siteKey) {
  await loadTurnstile();
  return new Promise((resolve) => {
    const state = { token: "" };
    const id = window.turnstile.render(container, {
      sitekey: siteKey,
      callback: (token) => {
        state.token = token;
      },
      "expired-callback": () => {
        state.token = "";
      },
      "error-callback": () => {
        state.token = "";
      },
    });
    state.reset = () => {
      state.token = "";
      window.turnstile.reset(id);
    };
    resolve(state);
  });
}

export async function initContact() {
  const contactForm = document.querySelector("#contact-form");
  const guestForm = document.querySelector("#guestbook-form");
  const noteList = document.querySelector("[data-notes]");
  if (!contactForm && !guestForm) return;

  let siteKey = "";
  try {
    const response = await fetch("/api/config");
    if (response.ok) siteKey = (await response.json()).turnstileSiteKey || "";
  } catch (error) {
    siteKey = "";
  }

  const contactWidget = siteKey && contactForm ? await mountWidget(document.querySelector("#contact-turnstile"), siteKey) : null;
  const guestWidget = siteKey && guestForm ? await mountWidget(document.querySelector("#guest-turnstile"), siteKey) : null;
  if (!siteKey) {
    setStatus(document.querySelector("#contact-status"), "", "The form turns on after Turnstile is configured. Email hello@matthewfinley.org in the meantime.");
    setStatus(document.querySelector("#guest-status"), "", "The guestbook turns on after Turnstile and D1 or KV are configured.");
  }

  contactForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.querySelector("#contact-status");
    const data = new FormData(contactForm);
    if (!contactWidget) {
      setStatus(status, "error", "Email hello@matthewfinley.org. The form is not configured yet.");
      return;
    }
    setStatus(status, "", "Sending…");
    try {
      const { response, data: body } = await postJson("/api/contact", {
        name: data.get("name"),
        email: data.get("email"),
        message: data.get("message"),
        company: data.get("company"),
        turnstileToken: contactWidget.token,
      });
      contactWidget.reset();
      if (!response.ok || !body.ok) {
        setStatus(status, "error", body.error || "The message was not sent.");
        return;
      }
      contactForm.reset();
      const extra = body.forwarded
        ? " A copy was forwarded by email."
        : " Email forwarding is not on, so hello@matthewfinley.org is the sure path.";
      setStatus(status, "ok", `Saved.${extra}`);
    } catch (error) {
      setStatus(status, "error", "The message was not sent. Email hello@matthewfinley.org.");
    }
  });

  async function refreshNotes() {
    if (!noteList) return;
    try {
      const response = await fetch("/api/guestbook");
      const body = await response.json();
      if (!response.ok) throw new Error("notes");
      if (!body.configured) {
        noteList.replaceChildren(Object.assign(document.createElement("li"), {
          textContent: "The guestbook is waiting on a D1 or KV binding.",
        }));
        return;
      }
      renderNotes(noteList, body.notes || []);
    } catch (error) {
      noteList.replaceChildren(Object.assign(document.createElement("li"), {
        textContent: "Notes could not be loaded.",
      }));
    }
  }

  guestForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.querySelector("#guest-status");
    if (!guestWidget) {
      setStatus(status, "error", "The guestbook is not configured yet.");
      return;
    }
    const data = new FormData(guestForm);
    setStatus(status, "", "Sending…");
    try {
      const { response, data: body } = await postJson("/api/guestbook", {
        name: data.get("name"),
        message: data.get("message"),
        company: data.get("company"),
        turnstileToken: guestWidget.token,
      });
      guestWidget.reset();
      if (!response.ok || !body.ok) {
        setStatus(status, "error", body.error || "The note was not saved.");
        return;
      }
      guestForm.reset();
      setStatus(status, "ok", "Received. It stays hidden until it is approved.");
    } catch (error) {
      setStatus(status, "error", "The note was not saved.");
    }
  });

  const review = document.querySelector("#review-form");
  const pending = document.querySelector("[data-pending]");
  review?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.querySelector("#review-status");
    const token = new FormData(review).get("token");
    setStatus(status, "", "Loading hidden notes…");
    try {
      const response = await fetch("/api/guestbook?scope=pending", {
        headers: { authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) {
        setStatus(status, "error", body.error || "Could not load hidden notes.");
        return;
      }
      pending.replaceChildren();
      (body.notes || []).forEach((note) => {
        const item = document.createElement("li");
        item.append(Object.assign(document.createElement("strong"), { textContent: `${note.name}: ` }));
        item.append(document.createTextNode(note.message));
        const approve = document.createElement("button");
        approve.type = "button";
        approve.className = "btn";
        approve.textContent = "Approve";
        const reject = document.createElement("button");
        reject.type = "button";
        reject.className = "btn";
        reject.textContent = "Reject";
        const act = async (approved) => {
          const result = await postJson("/api/moderate", { id: note.id, approved }, token);
          if (!result.response.ok) {
            setStatus(status, "error", result.data.error || "Update failed.");
            return;
          }
          item.remove();
          refreshNotes();
        };
        approve.addEventListener("click", () => act(true));
        reject.addEventListener("click", () => act(false));
        item.append(approve, reject);
        pending.append(item);
      });
      if (!pending.childElementCount) pending.append(Object.assign(document.createElement("li"), { textContent: "No notes waiting." }));
      setStatus(status, "ok", "Hidden notes loaded in this browser only.");
    } catch (error) {
      setStatus(status, "error", "Could not load hidden notes.");
    }
  });

  refreshNotes();
}
