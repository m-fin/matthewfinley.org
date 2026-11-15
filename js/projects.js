const CURATED = new Set(["skycharge", "drifthome", "jingle-ios", "lake-house-manager"]);

function text(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

export function initProjects() {
  const list = document.querySelector("[data-repo-list]");
  const status = document.querySelector("[data-repo-status]");
  if (!list || !status) return;
  const filter = document.querySelector("[data-repo-filter]");
  const forks = document.querySelector("[data-repo-forks]");
  let repos = [];

  function render() {
    const query = (filter?.value || "").trim().toLowerCase();
    const showForks = Boolean(forks?.checked);
    list.replaceChildren();
    const visible = repos.filter((repo) => {
      if (!showForks && repo.fork) return false;
      if (CURATED.has(repo.name.toLowerCase())) return false;
      if (!query) return true;
      return `${repo.name} ${repo.description || ""} ${repo.language || ""}`.toLowerCase().includes(query);
    });
    if (!visible.length) {
      list.append(text("li", null, "No repositories match that filter."));
      return;
    }
    visible.forEach((repo) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = repo.html_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = repo.name;
      item.append(link);
      item.append(text("p", null, repo.description || "No description on GitHub."));
      const bits = [repo.language || "Language not set", repo.fork ? "Fork" : "Original", repo.archived ? "Archived" : ""].filter(Boolean);
      const meta = text("p", "kicker", bits.join(" · "));
      if (repo.pushed_at) {
        const time = document.createElement("time");
        time.dateTime = repo.pushed_at;
        time.textContent = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(repo.pushed_at));
        meta.append(` · updated ${time.textContent}`);
      }
      item.append(meta);
      list.append(item);
    });
  }

  status.textContent = "Loading public repositories from GitHub…";
  fetch("https://api.github.com/users/m-fin/repos?per_page=100&sort=updated&type=owner")
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then((data) => {
      if (!Array.isArray(data)) throw new Error("shape");
      repos = data;
      status.textContent = "Descriptions in this list come from GitHub.";
      render();
    })
    .catch(() => {
      status.textContent = "GitHub did not return a repository list just now.";
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = "https://github.com/m-fin";
      link.textContent = "github.com/m-fin";
      item.append(link);
      list.append(item);
    });

  filter?.addEventListener("input", render);
  forks?.addEventListener("change", render);
}
