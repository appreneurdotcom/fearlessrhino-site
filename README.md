# Fearless Rhino — website + Domain Names CMS

A Node.js/Express site for fearlessrhino.com: the marketing site (home, services,
process, results, pricing, apps, blog, about, contact) plus a self-contained
**Domain Names** module for selling off a domain portfolio — a public listing
page, an individual page per domain with two purchase options, inquiry
emails, and an admin panel to manage the list via spreadsheet upload.

There is no Stripe or merchant account involved anywhere. Buyers submit a
contact form; you get an email; you reply with a payment link (e.g. an
Escrow.com transaction) yourself.

## Requirements

- Node.js 18 or newer
- npm

## Local setup

```bash
npm install
cp .env.example .env
```

Open `.env` and fill in real values — see **Environment variables** below.
At minimum, set `SESSION_SECRET` and `ADMIN_PASSWORD`.

```bash
npm start
```

The site runs at `http://localhost:3000`. The admin panel is at
`http://localhost:3000/admin` (it will redirect you to log in).

Use `npm run dev` instead of `npm start` while developing — it auto-restarts
on file changes.

## Environment variables

All of these are documented with examples in `.env.example`. Copy that file
to `.env` and edit it; `.env` is never read by anything except your own
server (it's git-ignored).

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no (default 3000) | Port the server listens on. Most hosts set this for you automatically. |
| `SESSION_SECRET` | **yes** | Long random string used to sign admin login cookies. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `APP_BASE_URL` | **yes** | Your live site URL, e.g. `https://fearlessrhino.com`. Used to build full page links in the admin CSV export and inside inquiry emails. |
| `ADMIN_PASSWORD` | **yes** (or the hash below) | Plain-text password for `/admin`. Simplest option. |
| `ADMIN_PASSWORD_HASH` | alternative to above | A bcrypt hash instead of a plain password. Generate with `node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"`. |
| `EMAIL_TO` | **yes** | Inbox that receives contact-form and domain-inquiry emails. Set to `hello@fearlessrhino.com`. |
| `EMAIL_FROM` | **yes** | The "from" address/name on outgoing inquiry emails. |
| `RESEND_API_KEY` | one of this or SMTP | Sends email via [Resend](https://resend.com)'s HTTP API. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | one of this or Resend | Sends email via any SMTP account (Gmail, Zoho, your registrar's mailbox, etc.). |

If neither `RESEND_API_KEY` nor `SMTP_HOST` is set, the site still runs
normally — every submission is still safely recorded in the admin panel's
inquiry log — it just won't land in your inbox until you configure one of
the two options.

### Email setup — pick one

**Option A: Resend (easiest).** Sign up at resend.com, verify a sending
domain (or use their `onboarding@resend.dev` address while testing), create
an API key, and set `RESEND_API_KEY`.

**Option B: SMTP.** Point it at any mailbox. For Gmail specifically: turn on
2-Step Verification, create an "App Password" at
`https://myaccount.google.com/apppasswords`, and use that as `SMTP_PASS`.

## Admin panel

Go to `/admin` and log in with `ADMIN_PASSWORD`.

**Uploading domains.** The dashboard has an upload card that accepts `.csv`
or `.xlsx` with these columns (a blank template is downloadable from the
dashboard):

- `Domain Name`
- `Description` — what the domain could be used for; shown on its page
- `Monthly Price`
- `Total Months`
- `Buy Now Price`

Leave `Monthly Price`/`Total Months` blank to hide the monthly option for
that domain, or `Buy Now Price` blank to hide the buy-now option. A domain
needs at least one of the two to be listed.

Two upload modes:
- **Merge** — adds new domains and updates existing ones matched by domain
  name. Anything already listed that isn't in the file is left alone. Safe
  to use repeatedly.
- **Replace** — wipes the current list first, then loads only what's in the
  file.

Uploading builds the single-page table at `/domains` automatically, plus an
individual page at `/domains/<slug>` for each domain.

**Editing/deleting** individual domains is available from the table on the
dashboard without needing a re-upload.

**Exporting.** "Download CSV" on the dashboard gives you every listed domain
with its exact live page URL — see the next section for what to do with it.

## Pointing your existing domains at their pages

Once a domain is uploaded, its page lives at:

```
https://fearlessrhino.com/domains/<slug>
```

(slug = the domain name, lowercased, with everything but letters/numbers
turned into hyphens — e.g. `getrhino.com` → `/domains/getrhino-com`.)

To make an idle domain in your portfolio actually show that page instead of
a parked page:

1. Download the CSV from the admin dashboard — it has one row per domain
   with its exact page URL already filled in.
2. In that domain's registrar (GoDaddy, Namecheap, Cloudflare, etc.), set up
   **domain forwarding** (sometimes called "URL forwarding" or "web
   forwarding") to the URL from the CSV. Masked/frame forwarding isn't
   necessary — a standard 301 redirect is fine.
3. Repeat for each domain. Since every registrar's forwarding UI is a little
   different, the CSV is meant to be something you can work down row by row
   regardless of which registrar each domain is parked at.

## Domain Names page behavior

- `/domains` lists every uploaded domain in one table (monthly price,
  one-time price), with the required Escrow.com disclosure paragraph above
  the table.
- Clicking a row opens `/domains/<slug>`: the domain name as the page title,
  a "For sale" label, the description, and up to two purchase panels.
- **Monthly Payment Plan** panel (if configured): submitting its form sends
  an email with subject `Domain Inquiry: <domain> — $<monthly>/mo x <N>
  months` and a body asking for a payment link.
- **Buy Now** panel (if configured): submitting its form sends an email with
  subject `Domain Inquiry: <domain> — Buy Now $<price>` and the same body.
- Every inquiry — whether the email send succeeds or not — is also saved to
  the admin panel's inquiry log as a backup.

## Deploying

This is a normal server-rendered Node app (not a static site), so it needs a
host that keeps a Node process running. These steps are for **Render**
(render.com), verified against Render's current docs as of this writing.
Railway, Fly.io, or a small VPS all work too, using the same general shape.

**Important: persistent storage, and why the free tier isn't enough.**
Domains and inquiries are stored as JSON files in the `data/` folder at the
project root (no external database required). Render's **free** web service
instances don't support attaching a persistent disk at all — their
filesystem resets on every deploy and on every spin-down, so anything
uploaded through the admin panel would vanish. Persistent disks require a
**paid** instance type, starting with **Starter at $7/month**. Disks
themselves are billed separately at **$0.25/GB/month** — 1GB is far more
than this app needs. Use at least the Starter plan.

Steps:

1. Push this project to a GitHub (or GitLab) repository. `.gitignore`
   already excludes `node_modules/`, `.env`, and the `data/*.json` files, so
   your real secrets and live domain data never get committed.
2. In the Render Dashboard: **New > Web Service**, connect that repository.
3. Configure:
   - Language: `Node`
   - Build command: `npm install`
   - Start command: `npm start`
   - Instance type: **Starter** or higher (required for the disk below)
4. Set all the environment variables from the table above under the
   service's Environment settings (never commit `.env` itself).
5. Add a persistent disk: on the service's **Disks** page, add a disk with
   mount path `/opt/render/project/src/data` (this is Render's project root
   for Node services, `/opt/render/project/src`, plus this app's `data`
   folder — that exact path is what makes the JSON files survive restarts
   and redeploys). 1GB is plenty.
6. Deploy, then visit `/admin` on the `onrender.com` URL Render gives you
   and log in to confirm the dashboard loads and email sending works
   (upload a single test domain and submit an inquiry on its page to check
   your inbox).
7. Add your custom domain under the service's **Custom Domains** settings,
   then point fearlessrhino.com's DNS at Render per the records it gives
   you. Update `APP_BASE_URL` to `https://fearlessrhino.com` once that's
   live.

Every push to the connected branch auto-deploys after the first setup.

## Security notes

- Admin routes require login (`/admin/login`) and are protected against
  cross-site request forgery — every admin form includes a per-session
  token that's checked on submit.
- Public forms (contact + domain inquiries) are rate-limited (5 submissions
  per 10 minutes per IP) and include an invisible honeypot field to quietly
  drop basic bots.
- Change `ADMIN_PASSWORD` to something you don't use anywhere else before
  going live, and keep `SESSION_SECRET` private.

## Project structure

```
server.js               Express app + all routes
src/
  db.js                  JSON-file datastore (domains + inquiries)
  uploadParser.js         .csv/.xlsx parsing for the domain upload
  mailer.js                Resend/SMTP email sending, with logging fallback
  emailTemplates.js         Subject/body for contact + domain inquiry emails
  middleware/adminAuth.js    Admin login gate + CSRF check
  content.js, nav.js, slug.js, format.js, rateLimit.js
views/                   EJS templates for every page (views/admin/ for the CMS)
public/                  CSS, client-side JS, and logo assets
data/                    domains.json + inquiries.json (created on first run)
```
