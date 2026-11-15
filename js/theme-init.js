(function () {
  var theme = "dark";
  try {
    var stored = localStorage.getItem("mf-theme");
    if (stored === "light" || stored === "dark") theme = stored;
    else if (window.matchMedia("(prefers-color-scheme: light)").matches) theme = "light";
  } catch (error) {
    theme = "dark";
  }
  document.documentElement.setAttribute("data-theme", theme);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f6f1e4" : "#10140f");
})();
