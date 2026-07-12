require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');

const db = require('./src/db');
const content = require('./src/content');
const mailer = require('./src/mailer');
const navLinks = require('./src/nav');
const { slugify } = require('./src/slug');
const { parseSpreadsheet } = require('./src/uploadParser');
const { requireAdmin, verifyCsrf } = require('./src/middleware/adminAuth');
const { formatMoney } = require('./src/format');
const { contactEmail, domainInquiryEmail } = require('./src/emailTemplates');
const { isRateLimited } = require('./src/rateLimit');

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    name: 'fr.sid',
    secret: process.env.SESSION_SECRET || 'insecure-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 8 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    },
  })
);

app.use((req, res, next) => {
  res.locals.navLinks = navLinks;
  res.locals.baseUrl = (process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  res.locals.formatMoney = formatMoney;
  next();
});

function wantsJson(req) {
  return req.xhr || (req.headers.accept || '').includes('application/json') || req.is('application/json');
}

/* ============================== Marketing pages ============================== */

app.get('/', (req, res) => {
  res.render('home', { active: 'home', title: 'Fearless Rhino — Be impossible to overlook.' });
});

app.get('/about', (req, res) => {
  res.render('about', { active: 'about', title: 'About — Fearless Rhino' });
});

app.get('/services', (req, res) => {
  res.render('services', { active: 'services', title: 'Services — Fearless Rhino' });
});

app.get('/process', (req, res) => {
  res.render('process', { active: 'process', title: 'Process — Fearless Rhino' });
});

app.get('/results', (req, res) => {
  res.render('results', { active: 'results', title: 'Results — Fearless Rhino' });
});

app.get('/pricing', (req, res) => {
  res.render('pricing', { active: 'pricing', title: 'Pricing — Fearless Rhino' });
});

app.get('/privacy', (req, res) => {
  res.render('privacy', { active: '', title: 'Privacy Policy — Fearless Rhino' });
});

app.get('/terms', (req, res) => {
  res.render('terms', { active: '', title: 'Terms & Conditions — Fearless Rhino' });
});

/* ================================== Apps ====================================== */

app.get('/apps', (req, res) => {
  res.render('apps', { active: 'applications', apps: content.apps, title: 'Applications — Fearless Rhino' });
});

app.get('/apps/:id', (req, res) => {
  const item = content.apps.find((a) => a.id === req.params.id);
  if (!item) {
    return res.status(404).render('app-detail', { active: 'applications', app: null, title: 'App not found — Fearless Rhino' });
  }
  res.render('app-detail', { active: 'applications', app: item, title: `${item.name} — Fearless Rhino` });
});

/* ================================== Blog ======================================= */

app.get('/blog', (req, res) => {
  res.render('blog', { active: 'blog', posts: content.posts, title: 'Blog — Fearless Rhino' });
});

app.get('/blog/:id', (req, res) => {
  const post = content.posts.find((p) => p.id === req.params.id);
  if (!post) {
    return res.status(404).render('blog-post', { active: 'blog', post: null, title: 'Post not found — Fearless Rhino' });
  }
  res.render('blog-post', { active: 'blog', post, title: `${post.title} — Fearless Rhino` });
});

/* ================================= Contact ===================================== */

app.get('/contact', (req, res) => {
  res.render('contact', {
    active: 'contact',
    title: 'Contact — Fearless Rhino',
    sent: req.query.sent === '1',
    formError: req.query.error || null,
  });
});

app.post('/contact', async (req, res) => {
  const respond = (status, payload, redirectQuery) => {
    if (wantsJson(req)) return res.status(status).json(payload);
    const qs = new URLSearchParams(redirectQuery).toString();
    return res.redirect(`/contact${qs ? `?${qs}` : ''}`);
  };

  if (req.body.hp_field) return respond(200, { ok: true }, { sent: '1' }); // honeypot: pretend success, do nothing

  const ip = req.ip || 'unknown';
  if (isRateLimited(`contact:${ip}`)) {
    return respond(429, { ok: false, error: 'Too many submissions. Please try again in a few minutes.' }, { error: 'Too many submissions. Please try again in a few minutes.' });
  }

  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim();
  const company = (req.body.company || '').trim();
  const message = (req.body.message || '').trim();

  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond(400, { ok: false, error: 'Please enter a valid name and email address.' }, { error: 'Please enter a valid name and email address.' });
  }

  const { subject, text } = contactEmail({ name, email, company, message });
  const result = await mailer.sendInquiryEmail({ subject, text, replyTo: email });

  db.addInquiry({
    type: 'contact',
    name,
    email,
    phone: null,
    domainSlug: null,
    domainName: null,
    subject,
    body: text,
    emailSent: result.sent,
    emailError: result.error,
  });

  return respond(200, { ok: true }, { sent: '1' });
});

/* ================================ Domain names ================================== */

app.get('/domains', (req, res) => {
  const domains = db.listDomains();
  res.render('domains', {
    active: 'domains',
    domains,
    title: 'Domain Names For Sale — Fearless Rhino',
    description: 'Premium .com and .ai domain names for sale — pay in full or in monthly installments, secured through Escrow.com.',
  });
});

app.get('/domains/:slug', (req, res) => {
  const domain = db.getDomainBySlug(req.params.slug);
  if (!domain) {
    return res.status(404).render('domain-detail', { active: 'domains', domain: null, title: 'Domain not found — Fearless Rhino' });
  }
  res.render('domain-detail', {
    active: 'domains',
    domain,
    title: `${domain.domainName} — Domain For Sale — Fearless Rhino`,
    description: domain.description || `${domain.domainName} is for sale.`,
    sent: req.query.sent || null,
    errorType: req.query.errorType || null,
    formError: req.query.error || null,
  });
});

app.post('/domains/:slug/inquire', async (req, res) => {
  const domain = db.getDomainBySlug(req.params.slug);
  const type = req.body.type === 'buynow' ? 'buynow' : 'monthly';

  const respond = (status, payload, redirectQuery) => {
    if (wantsJson(req)) return res.status(status).json(payload);
    const qs = new URLSearchParams(redirectQuery).toString();
    return res.redirect(`/domains/${req.params.slug}${qs ? `?${qs}` : ''}`);
  };

  if (!domain) return respond(404, { ok: false, error: 'That domain could not be found.' }, { error: 'That domain could not be found.', errorType: type });
  if (req.body.hp_field) return respond(200, { ok: true }, { sent: type }); // honeypot

  const ip = req.ip || 'unknown';
  if (isRateLimited(`domain:${ip}`)) {
    const msg = 'Too many submissions. Please try again in a few minutes.';
    return respond(429, { ok: false, error: msg }, { error: msg, errorType: type });
  }

  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim();
  const phone = (req.body.phone || '').trim();

  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const msg = 'Please enter a valid name and email address.';
    return respond(400, { ok: false, error: msg }, { error: msg, errorType: type });
  }
  if (type === 'monthly' && !domain.monthlyPrice) {
    const msg = 'A monthly plan is not available for this domain.';
    return respond(400, { ok: false, error: msg }, { error: msg, errorType: type });
  }
  if (type === 'buynow' && !domain.buyNowPrice) {
    const msg = 'A buy-now price is not available for this domain.';
    return respond(400, { ok: false, error: msg }, { error: msg, errorType: type });
  }

  const pageUrl = `${res.locals.baseUrl}/domains/${domain.slug}`;
  const { subject, text } = domainInquiryEmail({ type, domain, pageUrl, name, email, phone });
  const result = await mailer.sendInquiryEmail({ subject, text, replyTo: email });

  db.addInquiry({
    type: type === 'monthly' ? 'domain-monthly' : 'domain-buynow',
    name,
    email,
    phone: phone || null,
    domainSlug: domain.slug,
    domainName: domain.domainName,
    subject,
    body: text,
    emailSent: result.sent,
    emailError: result.error,
  });

  return respond(200, { ok: true }, { sent: type });
});

/* =================================== Admin ====================================== */

app.get('/admin/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin');
  res.render('admin/login', { title: 'Admin Login — Fearless Rhino', error: null, next: req.query.next || '/admin' });
});

app.post('/admin/login', (req, res) => {
  const password = req.body.password || '';
  const hash = process.env.ADMIN_PASSWORD_HASH;
  const plain = process.env.ADMIN_PASSWORD;

  let ok = false;
  if (hash) ok = bcrypt.compareSync(password, hash);
  else if (plain) ok = password === plain;

  if (!ok) {
    return res.status(401).render('admin/login', {
      title: 'Admin Login — Fearless Rhino',
      error: 'Incorrect password.',
      next: req.body.next || '/admin',
    });
  }

  req.session.isAdmin = true;
  const next = req.body.next && req.body.next.startsWith('/admin') ? req.body.next : '/admin';
  res.redirect(next);
});

app.post('/admin/logout', requireAdmin, verifyCsrf, (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

app.get('/admin', requireAdmin, (req, res) => {
  const domains = db.listDomains();
  res.render('admin/dashboard', {
    title: 'Admin — Fearless Rhino',
    domains,
    inquiries: db.listInquiries(20),
    flash: req.query.flash || null,
    flashType: req.query.flashType || 'ok',
    emailConfigured: mailer.isConfigured(),
  });
});

app.post('/admin/upload', requireAdmin, upload.single('spreadsheet'), verifyCsrf, async (req, res) => {
  if (!req.file) {
    return res.redirect('/admin?flashType=error&flash=' + encodeURIComponent('Please choose a spreadsheet file (.csv or .xlsx) to upload.'));
  }
  const mode = req.body.mode === 'replace' ? 'replace' : 'merge';

  try {
    const { rows, errors } = await parseSpreadsheet(req.file.buffer, req.file.originalname);
    if (!rows.length) {
      const msg = errors.length ? errors.join(' ') : 'No usable rows were found in that file.';
      return res.redirect('/admin?flashType=error&flash=' + encodeURIComponent(msg));
    }
    const result = db.upsertDomainsFromRows(rows, mode);
    let msg = `Uploaded ${rows.length} row(s): ${result.added} added, ${result.updated} updated. ${mode === 'replace' ? 'The previous list was replaced.' : ''}`.trim();
    if (errors.length) msg += ` (${errors.length} row(s) skipped — ${errors.slice(0, 3).join(' ')})`;
    return res.redirect('/admin?flashType=ok&flash=' + encodeURIComponent(msg));
  } catch (err) {
    console.error('[admin/upload] failed:', err);
    return res.redirect('/admin?flashType=error&flash=' + encodeURIComponent(`Could not read that file: ${err.message}`));
  }
});

app.get('/admin/template.csv', requireAdmin, (req, res) => {
  const header = 'Domain Name,Description,Monthly Price,Total Months,Buy Now Price\n';
  const example = 'example.com,"A short brandable name, great for a startup.",199,12,2500\n';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="domain-upload-template.csv"');
  res.send(header + example);
});

app.get('/admin/export.csv', requireAdmin, (req, res) => {
  const domains = db.listDomains();
  const rows = [['Domain Name', 'Page URL', 'Monthly Price', 'Total Months', 'Buy Now Price', 'Description', 'Date Added']];
  domains.forEach((d) => {
    rows.push([
      d.domainName,
      `${res.locals.baseUrl}/domains/${d.slug}`,
      d.monthlyPrice ?? '',
      d.totalMonths ?? '',
      d.buyNowPrice ?? '',
      d.description || '',
      d.createdAt ? d.createdAt.slice(0, 10) : '',
    ]);
  });
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="fearless-rhino-domains-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

app.get('/admin/domains/:id/edit', requireAdmin, (req, res) => {
  const domain = db.getDomainById(req.params.id);
  if (!domain) return res.redirect('/admin?flashType=error&flash=' + encodeURIComponent('Domain not found.'));
  res.render('admin/edit-domain', { title: `Edit ${domain.domainName} — Admin`, domain, error: null });
});

app.post('/admin/domains/:id/edit', requireAdmin, verifyCsrf, (req, res) => {
  const domain = db.getDomainById(req.params.id);
  if (!domain) return res.redirect('/admin?flashType=error&flash=' + encodeURIComponent('Domain not found.'));

  const domainName = (req.body.domainName || '').trim().toLowerCase();
  if (!domainName) {
    return res.status(400).render('admin/edit-domain', { title: `Edit ${domain.domainName} — Admin`, domain, error: 'Domain name is required.' });
  }

  const toNumber = (v) => {
    if (v === undefined || v === null || String(v).trim() === '') return null;
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  const toInt = (v) => {
    if (v === undefined || v === null || String(v).trim() === '') return null;
    const n = parseInt(String(v).replace(/[^0-9\-]/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  };

  db.updateDomainFields(domain.id, {
    domainName,
    slug: slugify(domainName),
    description: (req.body.description || '').trim(),
    monthlyPrice: toNumber(req.body.monthlyPrice),
    totalMonths: toInt(req.body.totalMonths),
    buyNowPrice: toNumber(req.body.buyNowPrice),
  });

  res.redirect('/admin?flashType=ok&flash=' + encodeURIComponent(`Updated ${domainName}.`));
});

app.post('/admin/domains/:id/delete', requireAdmin, verifyCsrf, (req, res) => {
  const domain = db.getDomainById(req.params.id);
  db.deleteDomain(req.params.id);
  res.redirect('/admin?flashType=ok&flash=' + encodeURIComponent(domain ? `Deleted ${domain.domainName}.` : 'Deleted.'));
});

/* ================================== 404 ========================================= */

app.use((req, res) => {
  res.status(404).render('404', { title: 'Page not found — Fearless Rhino', active: '' });
});

app.listen(PORT, () => {
  console.log(`Fearless Rhino site running at http://localhost:${PORT}`);
  if (!mailer.isConfigured()) {
    console.warn('[startup] No email provider configured yet (RESEND_API_KEY or SMTP_HOST) — inquiries will be logged but not emailed. See .env.example.');
  }
});
