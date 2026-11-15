# matthewfinley.org

Personal site for Matthew "Frog" Finley in Cary, NC. It is a static site (HTML, CSS, and JavaScript) with a few [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/) for the contact form, guestbook, and page-view counter.

There is no build step. Cloudflare Pages should publish the repository root as-is.

The contact address is hello@matthewfinley.org. The site does not publish a phone number or a street address.

## Preview locally

Static files only:

```bash
python3 -m http.server 8080
```

Open http://localhost:8080. Forms, the guestbook, and the view counter need the Pages runtime:

```bash
npx wrangler pages dev .
```

Copy `.dev.vars.example` to `.dev.vars` if you want local Turnstile keys. Cloudflare publishes test keys that always pass in [Turnstile testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/). Do not use those keys in production. `.dev.vars` is gitignored.

Regenerate HTML, `sitemap.xml`, and `feed.xml` after editing `content/*.html`:

```bash
python3 scripts/render_site.py
```

Commit the result. Pages does not run that script.

```bash
npm test
```

## Deploy on Cloudflare Pages

1. In the Cloudflare dashboard, go to **Workers & Pages** and create a Pages project connected to this GitHub repository.
2. Set the production branch to `main` after this change is merged.
3. **Build command:** leave empty. There is nothing to compile.
4. **Build output directory:** `/` (the repository root). `wrangler.toml` sets `pages_build_output_dir = "."` for the same reason.
5. Save and deploy. The first deploy works before KV, D1, Turnstile, or email are attached. The form and guestbook explain that they are not configured yet.
6. Add the custom domain `matthewfinley.org` on the project. `_redirects` sends `https://www.matthewfinley.org/*` to the apex. Production Pages applies that host rule. `wrangler pages dev` skips it and warns, because the local parser only accepts relative URLs.

Do not change the repository's visibility as part of deploying.

## Fill in support handles

All payment buttons are driven by [`config/site.json`](config/site.json). Every entry ships with `"enabled": false` and a `TODO` placeholder. The page renders a disabled "Not set up yet" state until both of these are true:

- `"enabled"` is `true`
- the link or address is real

For Cash App, Venmo, PayPal, X Money, Ko-fi, Buy Me a Coffee, and GitHub Sponsors, set `url` to a full `https://` link. `handle` is optional label text. Leave it as `TODO` or blank if you only want the service name.

For Bitcoin, Lightning, Ethereum, and Solana, set `address` to the real address (a Lightning address may be `name@domain` or a BOLT11 invoice). A QR code is drawn only after the address passes a format check. Do not invent an address to preview the QR code.

Redeploy after editing the file. `config/site.json` is cached with `no-cache`, but Pages still needs a new deployment for the file to change.

## Fill in the AdSense publisher ID

Google AdSense is not loaded. There is no ad script in the HTML and no publisher ID in the repo.

1. In [`config/site.json`](config/site.json), set `adsense.publisherId` to the `ca-pub-` value from your AdSense account.
2. Create three display ad units and paste their numeric slot IDs into `adsense.slots` for `home-1`, `projects-1`, and `article-1`.
3. Replace [`ads.txt`](ads.txt) with the single line AdSense gives you. The file is intentionally empty of publisher records until then.
4. Redeploy.

The marked **Advertisement** boxes stay empty until a publisher ID and a slot ID exist, and until the visitor presses **Accept** on the cookie notice. The privacy policy at `/privacy/` describes this. `_headers` allows Google's AdSense hosts in the Content-Security-Policy, including `unsafe-inline`, because AdSense injects inline script and style.

## Dashboard setup

Use these binding and variable names exactly. They are what the functions read. Secrets stay in the dashboard or in an uncommitted `.dev.vars`. Do not commit them.

### Environment variables

Pages project → **Settings** → **Variables and secrets**.

| Name | Secret? | Purpose |
| --- | --- | --- |
| `TURNSTILE_SITE_KEY` | No (it is public) | Site key. `/api/config` gives it to the browser. |
| `TURNSTILE_SECRET_KEY` | Yes | Server-side Turnstile check. |
| `MODERATION_TOKEN` | Yes | Bearer token for approving guestbook notes. Use a long random string. |
| `MAIL_PROVIDER` | No | Leave unset. Set to `mailchannels` only if you intentionally use that sender. |
| `RATE_LIMIT_SALT` | Yes, optional | Extra salt for rate-limit hashes. A default is used if this is empty. |
| `CONTACT_TO` | No | Already in `wrangler.toml` as `hello@matthewfinley.org`. |
| `CONTACT_FROM` | No | Already in `wrangler.toml` as `hello@matthewfinley.org`. Change it if you verify a different sender on the domain. |

Add the variables for **Production** and **Preview**, then redeploy. Changing a variable does not affect an already built deployment until you redeploy.

### Turnstile

1. In the Cloudflare dashboard, open **Turnstile** → **Add widget**.
2. Set the hostname to `matthewfinley.org` (and `localhost` if you test locally).
3. Widget mode: Managed.
4. Copy the site key into `TURNSTILE_SITE_KEY` and the secret key into `TURNSTILE_SECRET_KEY`.
5. Redeploy. The contact form and guestbook render the widget from `/api/config`. Submissions are rejected while the secret is missing.

### Workers KV (page views and rate limits)

1. **Workers & Pages** → **KV** → **Create namespace**. Name it `matthewfinley-views`.
2. Open the Pages project → **Settings** → **Bindings** → **Add** → **KV namespace**.
3. Variable name: `VIEWS`. Select the namespace you just created.
4. Optional: copy the namespace ID into `wrangler.toml`, uncomment the `[[kv_namespaces]]` block, and set `binding = "VIEWS"`.
5. Redeploy.

`/api/views` increments a counter. The footer shows it when the binding exists. The same namespace stores short-lived rate-limit keys and, if D1 is not bound, contact messages and guestbook entries.

### D1 (guestbook and contact messages)

1. **Workers & Pages** → **D1** → **Create database**. Name it `matthewfinley`.
2. Open the database console and run [`schema.sql`](schema.sql). The functions also run `CREATE TABLE IF NOT EXISTS` on first use.
3. Pages project → **Settings** → **Bindings** → **Add** → **D1 database**.
4. Variable name: `DB`. Select `matthewfinley`.
5. Optional: uncomment the `[[d1_databases]]` block in `wrangler.toml` and paste `database_name` and `database_id`.
6. Redeploy.

When `DB` is bound, guestbook notes and contact messages go to D1. KV is the fallback when D1 is absent. New guestbook notes are stored with `approved = 0` and are not public until moderated.

### Guestbook moderation

1. Set `MODERATION_TOKEN`.
2. Redeploy.
3. On the contact page, open **Review hidden notes**, paste the token, and load the queue. Approve or reject each note. The token is not stored in the repo. Do not save it in the page.

### Email Routing for hello@

This delivers mail sent to the public address. It is separate from the contact-form forwarder.

1. Add `matthewfinley.org` to this Cloudflare account if the registrar has not already.
2. **Email** → **Email Routing** → **Get started** / enable routing. Cloudflare will show the MX and SPF records to add. Use the records it prints. Do not invent extra MX hosts.
3. **Destination addresses** → add the Gmail account that should receive mail, and click the verification link Google sends.
4. **Routing rules** → **Create address**: custom address `hello`, domain `matthewfinley.org`, action **Send to** the verified Gmail destination.
5. Leave the catch-all disabled unless you want every other address on the domain to forward too.

Send a message from an outside account to hello@matthewfinley.org and confirm it arrives in Gmail.

### Forwarding the contact form

Preferred path, Email Routing send binding:

1. On the same zone, Email Routing must already be enabled.
2. Pages project → **Settings** → **Bindings** → add a **Send Email** binding if the dashboard offers it.
3. Variable name: `EMAIL`.
4. Optional: uncomment the `[[send_email]]` block in `wrangler.toml`. `destination_address` is `hello@matthewfinley.org`.
5. `CONTACT_FROM` has to be an address on `matthewfinley.org` that Email Routing is allowed to send from. The default is `hello@matthewfinley.org`.
6. Redeploy. A successful forward returns `forwarded: true` to the form. The message is still stored when D1 or KV is bound.

Optional path: set `MAIL_PROVIDER` to `mailchannels` to POST a plain message to MailChannels' send API. That path is not on by default. MailChannels may require its own domain authentication and may refuse mail from Cloudflare. Prefer the Email Routing binding.

If neither sender is configured, the form still stores the message and tells the visitor that email forwarding is off.

### Cloudflare Web Analytics

1. **Analytics & logs** → **Web Analytics** → **Add a site**.
2. Hostname: `matthewfinley.org`.
3. Copy the site token. Do not paste the example from Cloudflare's docs if it is not yours.
4. Put the token in `config/site.json` at `analytics.token`.
5. Redeploy.

The beacon is injected only when the token is present. It is omitted while the value is empty or `TODO`. Cloudflare's Web Analytics product does not use cookies. The privacy policy says that.

## Pages files

| File | Role |
| --- | --- |
| `_headers` | Security headers and a Content-Security-Policy that allows Turnstile, Web Analytics, and Google AdSense. |
| `_redirects` | Old HTML paths to `/legacy/`, plus `www` to the apex. |
| `_routes.json` | Runs Functions only for `/api/*`. |
| `404.html` | Custom not-found page. |
| `sitemap.xml`, `robots.txt` | `https://matthewfinley.org`. Legacy and `/api/` are disallowed. |
| `feed.xml` | RSS for the notes. |
| `manifest.webmanifest`, `sw.js` | Installable shell and an offline cache of the static pages. |
| `ads.txt` | Empty of publisher records until AdSense approval. |

API routes:

| Route | Behavior |
| --- | --- |
| `GET /api/config` | Returns the Turnstile site key only. |
| `GET /api/health` | Reports which bindings are present. No secret values. |
| `POST /api/contact` | Turnstile, then D1 or KV, then email if configured. |
| `GET/POST /api/guestbook` | Public list is approved notes only. `?scope=pending` needs the moderator token. |
| `POST /api/moderate` | Approve or reject a note. |
| `GET/POST /api/views` | Read or increment the KV page counter. |

## Legacy pages

`/legacy/` is the previous site, kept rather than deleted. It is not maintained. `robots.txt` disallows it and `_headers` marks it `noindex`.

## Fonts and the QR helper

Fraunces, Outfit, and IBM Plex Mono are under the SIL Open Font License. The license texts are in `assets/fonts/`. `js/qrcode.js` is Kazuhiko Arase's QR Code Generator, MIT licensed. QR codes are generated in the browser only for a support method that is enabled and has a real address.
