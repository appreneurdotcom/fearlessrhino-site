/**
 * Tiny file-based data store.
 *
 * There's no external database here on purpose — the whole point is that
 * this app can run on almost any Node host without extra services to set
 * up. Domain listings and inquiry logs live in JSON files under /data.
 * Writes are atomic (write to a temp file, then rename) so a crash mid-write
 * can't corrupt the file.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DOMAINS_FILE = path.join(DATA_DIR, 'domains.json');
const INQUIRIES_FILE = path.join(DATA_DIR, 'inquiries.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  ensureDataDir();
  if (!fs.existsSync(file)) return fallback;
  try {
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to read ${file}, using fallback. Error: ${err.message}`);
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDataDir();
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

/* ---------------------------- Domains ---------------------------- */

function loadDomains() {
  return readJson(DOMAINS_FILE, []);
}

function saveDomains(domains) {
  writeJson(DOMAINS_FILE, domains);
}

function listDomains() {
  const domains = loadDomains();
  return domains.slice().sort((a, b) => a.domainName.localeCompare(b.domainName));
}

function getDomainBySlug(slug) {
  return loadDomains().find((d) => d.slug === slug) || null;
}

function getDomainById(id) {
  return loadDomains().find((d) => d.id === id) || null;
}

/**
 * Replace or merge a batch of parsed spreadsheet rows into the store.
 * mode 'merge'   -> upsert by domain name (default, non-destructive)
 * mode 'replace' -> wipe the existing list first, then insert everything
 */
function upsertDomainsFromRows(rows, mode = 'merge') {
  const now = new Date().toISOString();
  const existing = mode === 'replace' ? [] : loadDomains();
  const byName = new Map(existing.map((d) => [d.domainName.toLowerCase(), d]));
  const usedSlugs = new Set(existing.map((d) => d.slug));

  let added = 0;
  let updated = 0;

  for (const row of rows) {
    const key = row.domainName.toLowerCase();
    const found = byName.get(key);
    if (found) {
      found.description = row.description;
      found.monthlyPrice = row.monthlyPrice;
      found.totalMonths = row.totalMonths;
      found.buyNowPrice = row.buyNowPrice;
      found.updatedAt = now;
      updated += 1;
    } else {
      let slug = row.slug;
      let suffix = 2;
      while (usedSlugs.has(slug)) {
        slug = `${row.slug}-${suffix}`;
        suffix += 1;
      }
      usedSlugs.add(slug);
      const record = {
        id: crypto.randomUUID(),
        domainName: row.domainName,
        slug,
        description: row.description,
        monthlyPrice: row.monthlyPrice,
        totalMonths: row.totalMonths,
        buyNowPrice: row.buyNowPrice,
        createdAt: now,
        updatedAt: now,
      };
      byName.set(key, record);
      added += 1;
    }
  }

  const result = Array.from(byName.values());
  saveDomains(result);
  return { added, updated, total: result.length, skipped: 0 };
}

function updateDomainFields(id, fields) {
  const domains = loadDomains();
  const idx = domains.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  domains[idx] = { ...domains[idx], ...fields, updatedAt: new Date().toISOString() };
  saveDomains(domains);
  return domains[idx];
}

function deleteDomain(id) {
  const domains = loadDomains();
  const next = domains.filter((d) => d.id !== id);
  const changed = next.length !== domains.length;
  if (changed) saveDomains(next);
  return changed;
}

function deleteAllDomains() {
  saveDomains([]);
}

/* --------------------------- Inquiries ---------------------------- */

function loadInquiries() {
  return readJson(INQUIRIES_FILE, []);
}

function addInquiry(inquiry) {
  const inquiries = loadInquiries();
  const record = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...inquiry,
  };
  inquiries.unshift(record);
  // Keep the log from growing forever — 2000 most recent submissions is plenty.
  writeJson(INQUIRIES_FILE, inquiries.slice(0, 2000));
  return record;
}

function listInquiries(limit = 100) {
  return loadInquiries().slice(0, limit);
}

module.exports = {
  listDomains,
  getDomainBySlug,
  getDomainById,
  upsertDomainsFromRows,
  updateDomainFields,
  deleteDomain,
  deleteAllDomains,
  addInquiry,
  listInquiries,
};
