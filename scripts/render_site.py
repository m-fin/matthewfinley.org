#!/usr/bin/env python3
"""Regenerate static HTML, sitemap, and RSS from content fragments.

Cloudflare Pages does not need this step. The generated files are committed.
Run `python3 scripts/render_site.py` after editing content/*.html.
"""

from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content"
ORIGIN = "https://matthewfinley.org"

NAV = [
    ("/", "Home", "home"),
    ("/about/", "About", "about"),
    ("/projects/", "Projects", "projects"),
    ("/inventions/", "Inventions", "inventions"),
    ("/music/", "Music", "music"),
    ("/videos/", "Videos", "videos"),
    ("/blog/", "Blog", "blog"),
    ("/links/", "Links", "links"),
    ("/support/", "Support", "support"),
    ("/contact/", "Contact", "contact"),
]

POSTS = [
    {
        "path": "/blog/new-site/",
        "title": "A site of my own",
        "date": "2026-11-15",
        "description": "Why matthewfinley.org is a new static site, and what happened to the old pages.",
        "file": "post-new-site.html",
    },
    {
        "path": "/blog/what-im-making/",
        "title": "What I'm making",
        "date": "2026-11-15",
        "description": "SKYCHARGE, DRIFTHOME, Jingle, and Lake House Manager, with the public links separated from the builds that are not ready.",
        "file": "post-making.html",
    },
    {
        "path": "/blog/interests/",
        "title": "Bots, robots, drones, and Bitcoin",
        "date": "2026-11-15",
        "description": "The subjects Matthew Finley keeps coming back to, stated without turning them into projects he has not published.",
        "file": "post-interests.html",
    },
]

PAGES = [
    {
        "path": "/",
        "title": 'Matthew "Frog" Finley',
        "description": "Matthew \"Frog\" Finley is a computer science student in Cary, NC, making games, apps, and music.",
        "file": "home.html",
        "nav": "home",
        "robots": "index,follow",
    },
    {
        "path": "/about/",
        "title": "About · Matthew Finley",
        "description": "About Matthew Finley: a CS student in Cary, NC, with games, sonicrift, and a 2021 internship at RIA Advisory.",
        "file": "about.html",
        "nav": "about",
    },
    {
        "path": "/projects/",
        "title": "Projects · Matthew Finley",
        "description": "SKYCHARGE, DRIFTHOME, Jingle, and Lake House Manager, plus the public repositories on GitHub.",
        "file": "projects.html",
        "nav": "projects",
    },
    {
        "path": "/inventions/",
        "title": "Inventions · Matthew Finley",
        "description": "Inventions and named work by Matthew Finley, including a phone harness that is coming soon, plus SKYCHARGE, DRIFTHOME, and Jingle.",
        "file": "inventions.html",
        "nav": "inventions",
    },
    {
        "path": "/music/",
        "title": "Music · sonicrift",
        "description": "sonicrift is Matthew Finley's music project. The name is always lowercase. Signals, coded pieces, alto sax, Spotify, Apple Music, and SoundCloud.",
        "file": "music.html",
        "nav": "music",
    },
    {
        "path": "/videos/",
        "title": "Videos · Matthew Finley",
        "description": "Videos from Matthew Finley's YouTube channel @AOECGB.",
        "file": "videos.html",
        "nav": "videos",
    },
    {
        "path": "/blog/",
        "title": "Blog · Matthew Finley",
        "description": "Notes from Matthew Finley on this site, the work in progress, and the subjects he is interested in.",
        "file": "blog.html",
        "nav": "blog",
    },
    *[
        {
            "path": post["path"],
            "title": f"{post['title']} · Matthew Finley",
            "description": post["description"],
            "file": post["file"],
            "nav": "blog",
            "post": post,
        }
        for post in POSTS
    ],
    {
        "path": "/support/",
        "title": "Support me · Matthew Finley",
        "description": "Support Matthew Finley's games, music, and experiments. Every payment method stays off until a real link is added.",
        "file": "support.html",
        "nav": "support",
    },
    {
        "path": "/contact/",
        "title": "Contact · Matthew Finley",
        "description": "Email hello@matthewfinley.org, send a note through the form, or leave a moderated guestbook message.",
        "file": "contact.html",
        "nav": "contact",
    },
    {
        "path": "/links/",
        "title": "Links · Matthew Finley",
        "description": "Link-in-bio page for Matthew Finley: GitHub, X, YouTube, SoundCloud, Spotify, Apple Music, email, and this site.",
        "file": "links.html",
        "nav": "links",
    },
    {
        "path": "/privacy/",
        "title": "Privacy policy · Matthew Finley",
        "description": "Privacy policy for matthewfinley.org, including cookies, Google AdSense, Cloudflare, and the contact form.",
        "file": "privacy.html",
        "nav": "",
    },
    {
        "path": "/404.html",
        "title": "Page not found · Matthew Finley",
        "description": "That page is not on matthewfinley.org.",
        "file": "404.html",
        "nav": "",
        "robots": "noindex",
    },
]

SUPPORT_METHODS = [
    "Cash App",
    "Venmo",
    "PayPal",
    "X Money",
    "Ko-fi",
    "Buy Me a Coffee",
    "GitHub Sponsors",
    "Bitcoin",
    "Lightning",
    "Ethereum",
    "Solana",
]


def support_html():
    items = "\n".join(
        f'          <li><div class="pay-disabled"><span class="pay-name">{escape(name)}</span>'
        f'<span class="pay-state">Not set up yet</span></div></li>'
        for name in SUPPORT_METHODS
    )
    return f"""<div data-support-root>
        <ul class="pay-grid">
{items}
        </ul>
        <p>Payment buttons stay off until a real link or address is added. Nothing here is a stand-in handle.</p>
      </div>"""


def ad_html(slot):
    return f"""<aside class="ad-slot" data-ad-placement="{escape(slot)}" aria-label="Advertisement">
        <p class="ad-label">Advertisement</p>
        <div class="ad-frame">
          <p class="ad-pending">This space is reserved for a Google AdSense unit. It stays empty until a publisher ID and ad unit ID are added, and until advertising cookies are accepted.</p>
        </div>
      </aside>"""


def post_cards(compact=False):
    heading = "h3" if compact else "h2"
    chunks = []
    for post in POSTS:
        chunks.append(
            f"""<article class="article-card">
        <p class="kicker"><time datetime="{post['date']}">November 15, 2026</time></p>
        <{heading}><a href="{post['path']}">{escape(post['title'])}</a></{heading}>
        <p>{escape(post['description'])}</p>
      </article>"""
        )
    class_name = "post-list" if compact else "cards"
    return f'<div class="{class_name}">\n' + "\n".join(chunks) + "\n</div>"


def apply_tokens(raw):
    raw = raw.replace("{{SUPPORT}}", support_html())
    raw = raw.replace("{{POST_CARDS}}", post_cards(False))
    raw = raw.replace("{{POST_LINKS}}", post_cards(True))
    while "{{AD:" in raw:
        start = raw.index("{{AD:")
        end = raw.index("}}", start)
        slot = raw[start + 5 : end]
        raw = raw[:start] + ad_html(slot) + raw[end + 2 :]
    return raw


def nav_html(current):
    links = []
    for href, label, key in NAV:
        current_attr = ' aria-current="page"' if key == current else ""
        extra = ' class="nav-support"' if key == "support" else ""
        links.append(f'<a href="{href}"{current_attr}{extra}>{label}</a>')
    return "\n          ".join(links)


def render_page(page):
    body = apply_tokens((CONTENT / page["file"]).read_text())
    canonical = ORIGIN + ("/" if page["path"] == "/" else page["path"])
    robots = page.get("robots", "index,follow")
    description = escape(page["description"])
    title = escape(page["title"])
    home_json = ""
    if page["path"] == "/":
        home_json = """
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Person","name":"Matthew Finley","alternateName":"Frog","email":"hello@matthewfinley.org","homeLocation":{"@type":"Place","name":"Cary, NC"},"url":"https://matthewfinley.org/","sameAs":["https://github.com/m-fin","https://x.com/matthew1","https://www.youtube.com/@AOECGB","https://soundcloud.com/sonicrift","https://open.spotify.com/artist/622lO1Sz70XKqIC80aKaYf","https://music.apple.com/us/artist/matthew-finley/901965944"]}
  </script>"""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{description}">
  <meta name="author" content="Matthew Finley">
  <meta name="robots" content="{robots}">
  <link rel="canonical" href="{canonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Matthew Finley">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:image" content="{ORIGIN}/og/og-default.png">
  <meta property="og:image:alt" content="Matthew Frog Finley, Cary, NC. Games, apps, and music.">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{description}">
  <meta name="twitter:image" content="{ORIGIN}/og/og-default.png">
  <meta name="twitter:creator" content="@matthew1">
  <meta name="theme-color" content="#10140f">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="alternate" type="application/rss+xml" title="Matthew Finley" href="{ORIGIN}/feed.xml">
  <link rel="me" href="https://github.com/m-fin">
  <link rel="me" href="https://x.com/matthew1">
  <link rel="me" href="https://www.youtube.com/@AOECGB">
  <link rel="me" href="https://soundcloud.com/sonicrift">
  <link rel="me" href="https://open.spotify.com/artist/622lO1Sz70XKqIC80aKaYf">
  <link rel="me" href="https://music.apple.com/us/artist/matthew-finley/901965944">
  <link rel="preload" href="/assets/fonts/fraunces-600.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/fonts/outfit-400.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/styles.css">
  <script src="/js/theme-init.js"></script>{home_json}
</head>
<body data-page="{escape(page['nav'] or 'page')}">
  <a class="skip" href="#content">Skip to content</a>
  <header class="site-header">
    <div class="wrap bar">
      <a class="wordmark" href="/"><span aria-hidden="true">MF</span><span class="visually-hidden">Matthew Finley, home</span></a>
      <button type="button" class="nav-toggle" id="nav-toggle" aria-expanded="false" aria-controls="site-nav">Menu</button>
      <nav id="site-nav" class="nav" aria-label="Primary">
        {nav_html(page["nav"])}
      </nav>
      <button type="button" class="theme-toggle" id="theme-toggle">Light theme</button>
    </div>
  </header>
  <main id="content" tabindex="-1">
{body}
  </main>
  <footer class="site-footer">
    <div class="wrap">
      <div>
        <strong>Matthew "Frog" Finley</strong>
        <p>Cary, NC · <a href="mailto:hello@matthewfinley.org">hello@matthewfinley.org</a></p>
        <p class="views" data-views hidden></p>
      </div>
      <nav class="footer-nav" aria-label="Footer">
        <a href="/privacy/">Privacy</a>
        <a href="/feed.xml">RSS</a>
        <a href="/links/">Links</a>
        <a href="/support/">Support</a>
        <a href="/legacy/">Archived pages</a>
      </nav>
    </div>
  </footer>
  <div id="cookie-notice" class="cookie" role="region" aria-label="Cookie notice" hidden>
    <p>Advertising cookies stay off until you accept them. If Google AdSense is enabled later, accepting lets this site load Google's ad script, which can set cookies. Rejecting keeps that script off. The theme and this choice stay in this browser. Cloudflare Web Analytics, when a token is configured, does not use cookies. <a href="/privacy/">Privacy policy</a>.</p>
    <div class="actions">
      <button type="button" class="btn btn-accent" data-consent="accepted">Accept</button>
      <button type="button" class="btn" data-consent="rejected">Reject</button>
    </div>
  </div>
  <script type="module" src="/js/site.js"></script>
</body>
</html>
"""


def output_path(url_path):
    if url_path == "/":
        return ROOT / "index.html"
    if url_path.endswith(".html"):
        return ROOT / url_path.lstrip("/")
    return ROOT / url_path.strip("/") / "index.html"


def write_sitemap(pages):
    urls = []
    for page in pages:
        if page["path"].endswith("404.html"):
            continue
        loc = ORIGIN + ("/" if page["path"] == "/" else page["path"])
        urls.append(
            f"  <url><loc>{escape(loc)}</loc><lastmod>2026-11-15</lastmod></url>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    (ROOT / "sitemap.xml").write_text(xml)


def write_feed():
    items = []
    for post in POSTS:
        link = ORIGIN + post["path"]
        body = apply_tokens((CONTENT / post["file"]).read_text())
        items.append(
            f"""  <item>
    <title>{escape(post['title'])}</title>
    <link>{link}</link>
    <guid>{link}</guid>
    <pubDate>Sun, 15 Nov 2026 12:00:00 GMT</pubDate>
    <description>{escape(post['description'])}</description>
    <content:encoded><![CDATA[{body}]]></content:encoded>
  </item>"""
        )
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Matthew Finley</title>
  <link>{ORIGIN}/</link>
  <atom:link href="{ORIGIN}/feed.xml" rel="self" type="application/rss+xml"/>
  <description>Notes from Matthew "Frog" Finley in Cary, NC.</description>
  <language>en-us</language>
  <lastBuildDate>Sun, 15 Nov 2026 12:00:00 GMT</lastBuildDate>
{chr(10).join(items)}
</channel>
</rss>
"""
    (ROOT / "feed.xml").write_text(xml)


def main():
    for page in PAGES:
        path = output_path(page["path"])
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(render_page(page))
        print(path.relative_to(ROOT))
    write_sitemap(PAGES)
    write_feed()
    print("sitemap.xml feed.xml")


if __name__ == "__main__":
    main()
