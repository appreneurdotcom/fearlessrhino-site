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

function monthYearToISO(str) {
  const months = { January: '01', February: '02', March: '03', April: '04', May: '05', June: '06', July: '07', August: '08', September: '09', October: '10', November: '11', December: '12' };
  const parts = String(str || '').trim().split(/\s+/);
  if (parts.length === 2 && months[parts[0]]) return `${parts[1]}-${months[parts[0]]}-01`;
  return null;
}
function ldjson(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

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
  res.locals.canonicalUrl = `${res.locals.baseUrl}${req.path}`;
  res.locals.formatMoney = formatMoney;
  next();
});

function wantsJson(req) {
  return req.xhr || (req.headers.accept || '').includes('application/json') || req.is('application/json');
}

/* ============================== Marketing pages ============================== */

app.get('/', (req, res) => {
  res.render('home', { active: 'home', title: 'Fearless Rhino — Be impossible to overlook.' , description: 'Fearless Rhino fixes your branding, gets you found across Google and AI search, and builds custom automation so your business is impossible to overlook.' });
});

app.get('/about', (req, res) => {
  res.render('about', { active: 'about', title: 'About — Fearless Rhino' , description: 'Meet Fearless Rhino, a branding, visibility, AI, and automation studio for businesses that refuse to be overlooked.' });
});

app.get('/services', (req, res) => {
  res.render('services', { active: 'services', title: 'Services — Fearless Rhino' , description: 'Branding, SEO and AI-search visibility (GEO and AEO), custom automation, and AI builds from Fearless Rhino, so you get found and win the work.' });
});

app.get('/process', (req, res) => {
  res.render('process', { active: 'process', title: 'Process — Fearless Rhino' , description: 'How Fearless Rhino works: a clear, repeatable process from brand and visibility audit through build, launch, and ongoing optimization.' });
});

app.get('/results', (req, res) => {
  res.render('results', { active: 'results', title: 'Results — Fearless Rhino' , description: 'Real outcomes from Fearless Rhino clients across branding, search and AI visibility, and automation.' });
});

app.get('/pricing', (req, res) => {
  res.render('pricing', { active: 'pricing', title: 'Pricing — Fearless Rhino' , description: 'Simple, transparent pricing for Fearless Rhino branding, visibility, and automation engagements.' });
});

app.get('/privacy', (req, res) => {
  res.render('privacy', { active: '', title: 'Privacy Policy — Fearless Rhino' , description: 'How Fearless Rhino collects, uses, and protects your information.' });
});

app.get('/terms', (req, res) => {
  res.render('terms', { active: '', title: 'Terms & Conditions — Fearless Rhino' , description: 'The terms and conditions governing use of the Fearless Rhino website and services.' });
});

/* ================================== Apps ====================================== */

app.get('/apps', (req, res) => {
  res.render('apps', { active: 'applications', apps: content.apps, title: 'Applications — Fearless Rhino' , description: 'Applications from Fearless Rhino, including RhinoRank, CitationForge, and Herd Signals for AI search visibility and GEO.' });
});

app.get('/apps/:id', (req, res) => {
  const item = content.apps.find((a) => a.id === req.params.id);
  if (!item) {
    return res.status(404).render('app-detail', { active: 'applications', app: null, title: 'App not found — Fearless Rhino' });
  }
  const appLd = ldjson({ '@context': 'https://schema.org', '@graph': [
    { '@type': 'SoftwareApplication', name: item.name, applicationCategory: item.category, description: item.blurb, publisher: { '@type': 'Organization', name: 'Fearless Rhino', url: `${res.locals.baseUrl}/` } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${res.locals.baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Applications', item: `${res.locals.baseUrl}/apps` },
      { '@type': 'ListItem', position: 3, name: item.name, item: `${res.locals.baseUrl}/apps/${item.id}` },
    ] },
  ] });
  res.render('app-detail', { active: 'applications', app: item, title: `${item.name} — Fearless Rhino`, description: item.blurb, ogType: 'article', jsonLd: appLd });
});

/* ================================== Blog ======================================= */

app.get('/blog', (req, res) => {
  res.render('blog', { active: 'blog', posts: content.posts, title: 'Blog — Fearless Rhino' , description: 'Insights from Fearless Rhino on SEO, GEO, AEO, AI search visibility, and automation.' });
});

app.get('/blog/:id', (req, res) => {
  const post = content.posts.find((p) => p.id === req.params.id);
  if (!post) {
    return res.status(404).render('blog-post', { active: 'blog', post: null, title: 'Post not found — Fearless Rhino' });
  }
  const _iso = monthYearToISO(post.date);
  const postLd = ldjson({ '@context': 'https://schema.org', '@graph': [
    Object.assign({ '@type': 'BlogPosting', headline: post.title, description: post.excerpt, mainEntityOfPage: `${res.locals.baseUrl}/blog/${post.id}`, author: { '@type': 'Organization', name: 'Fearless Rhino' }, publisher: { '@type': 'Organization', name: 'Fearless Rhino', logo: { '@type': 'ImageObject', url: `${res.locals.baseUrl}/images/logo/mark-lime-1024.png` } } }, _iso ? { datePublished: _iso } : {}),
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${res.locals.baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${res.locals.baseUrl}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${res.locals.baseUrl}/blog/${post.id}` },
    ] },
  ] });
  res.render('blog-post', { active: 'blog', post, title: `${post.title} — Fearless Rhino`, description: post.excerpt, ogType: 'article', jsonLd: postLd });
});

/* ================================= Contact ===================================== */

app.get('/contact', (req, res) => {
  res.render('contact', {
    active: 'contact',
    title: 'Contact — Fearless Rhino',
    description: 'Get in touch with Fearless Rhino. Book a strategy call or send a message about branding, visibility, AI, and automation.',
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
  const _price = domain.buyNowPrice || (domain.monthlyPrice && domain.totalMonths ? domain.monthlyPrice * domain.totalMonths : domain.monthlyPrice) || null;
  const domainLd = ldjson({ '@context': 'https://schema.org', '@graph': [
    Object.assign({ '@type': 'Product', name: domain.domainName, description: domain.description || `${domain.domainName} is a premium domain name for sale.`, category: 'Domain name', url: `${res.locals.baseUrl}/domains/${domain.slug}` }, _price ? { offers: { '@type': 'Offer', price: String(_price), priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: `${res.locals.baseUrl}/domains/${domain.slug}` } } : {}),
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${res.locals.baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Domain Names', item: `${res.locals.baseUrl}/domains` },
      { '@type': 'ListItem', position: 3, name: domain.domainName, item: `${res.locals.baseUrl}/domains/${domain.slug}` },
    ] },
  ] });
  res.render('domain-detail', {
    active: 'domains',
    domain,
    title: `${domain.domainName} — Domain For Sale — Fearless Rhino`,
    description: domain.description || `${domain.domainName} is for sale.`,
    ogType: 'product',
    jsonLd: domainLd,
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

/* ============================ robots.txt & sitemap ============================== */

app.get('/robots.txt', (req, res) => {
  const body = `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${res.locals.baseUrl}/sitemap.xml\n`;
  res.type('text/plain').send(body);
});

app.get('/sitemap.xml', (req, res) => {
  const base = res.locals.baseUrl;
  const paths = ['/', '/about', '/services', '/process', '/results', '/pricing', '/apps', '/blog', '/contact', '/domains', '/privacy', '/terms'];
  content.apps.forEach((a) => paths.push(`/apps/${a.id}`));
  content.posts.forEach((p) => paths.push(`/blog/${p.id}`));
  try { db.listDomains().forEach((d) => paths.push(`/domains/${d.slug}`)); } catch (e) {}
  const esc = (u) => u.replace(/&/g, '&amp;');
  const urls = paths.map((u) => `  <url><loc>${esc(base + u)}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  res.type('application/xml').send(xml);
});

/* ================================== 404 ========================================= */

app.use((req, res) => {
  res.status(404).render('404', { title: 'Page not found — Fearless Rhino', active: '', noindex: true });
});

app.listen(PORT, () => {
  console.log(`Fearless Rhino site running at http://localhost:${PORT}`);
  if (!mailer.isConfigured()) {
    console.warn('[startup] No email provider configured yet (RESEND_API_KEY or SMTP_HOST) — inquiries will be logged but not emailed. See .env.example.');
  }
});
