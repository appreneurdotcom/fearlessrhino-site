/**
 * Turns an uploaded spreadsheet (.csv, .xlsx, or .xls) into normalized
 * domain rows: { domainName, slug, description, monthlyPrice, totalMonths, buyNowPrice }
 *
 * Column headers are matched loosely (case/spacing/punctuation-insensitive)
 * against a list of accepted aliases, so "Monthly Price", "monthly_price",
 * and "Monthly" all resolve to the same field.
 */

const { parse } = require('csv-parse/sync');
const ExcelJS = require('exceljs');
const { slugify } = require('./slug');

const FIELD_ALIASES = {
  // Deliberately NOT including a bare "name" alias here — it's too easy for
  // an unrelated column (e.g. a contact's name) to collide with it. Domain
  // name columns should say "Domain" or "Domain Name" (see the template).
  domainName: ['domain', 'domainname', 'domain name', 'url', 'website'],
  description: ['description', 'desc', 'use case', 'usecase', 'notes', 'about'],
  monthlyPrice: ['monthlyprice', 'monthly price', 'monthly', 'pricepermonth', 'monthlypayment', 'monthly payment'],
  totalMonths: ['totalmonths', 'total months', 'months', 'numberofmonths', 'monthstopay', 'term', 'termmonths'],
  buyNowPrice: ['buynowprice', 'buy now price', 'buynow', 'buy now', 'onetimeprice', 'one time price', 'onetime', 'outright', 'outrightprice', 'lumpsum', 'buyitnow', 'buy it now'],
};

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function buildHeaderMap(headers) {
  const map = {}; // field -> column index
  const normalized = headers.map(normalizeHeader);
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const normalizedAliases = aliases.map((a) => a.replace(/[^a-z0-9]+/g, ' ').trim());
    const idx = normalized.findIndex((h) => normalizedAliases.includes(h));
    if (idx !== -1) map[field] = idx;
  }
  return map;
}

function cleanMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const str = String(value).replace(/[^0-9.\-]/g, '');
  if (!str) return null;
  const num = parseFloat(str);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
}

function cleanInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseInt(String(value).replace(/[^0-9\-]/g, ''), 10);
  return Number.isFinite(num) ? num : null;
}

function cleanDomainName(value) {
  let str = String(value || '').trim().toLowerCase();
  str = str.replace(/^https?:\/\//, '').replace(/^www\./, '');
  str = str.split('/')[0].split('?')[0].trim();
  return str;
}

function rowsFromRecords(records) {
  const rows = [];
  const errors = [];
  if (!records.length) return { rows, errors: ['The file has no data rows.'] };

  const headers = records[0].__isArray ? records[0].values : Object.keys(records[0]);
  const headerMap = records[0].__isArray ? buildHeaderMap(headers) : buildHeaderMap(Object.keys(records[0]));

  if (headerMap.domainName === undefined) {
    errors.push('Could not find a "Domain Name" column. Expected headers: Domain Name, Description, Monthly Price, Total Months, Buy Now Price.');
    return { rows, errors };
  }

  records.forEach((record, i) => {
    const get = (field) => {
      if (record.__isArray) {
        const idx = headerMap[field];
        return idx === undefined ? undefined : record.values[idx];
      }
      const key = Object.keys(record)[headerMap[field]];
      return key === undefined ? undefined : record[key];
    };

    const domainNameRaw = get('domainName');
    const domainName = cleanDomainName(domainNameRaw);
    if (!domainName) {
      // Silently skip fully blank rows; only flag rows that had *some* data.
      const hasOtherData = ['description', 'monthlyPrice', 'totalMonths', 'buyNowPrice'].some((f) => {
        const v = get(f);
        return v !== undefined && String(v).trim() !== '';
      });
      if (hasOtherData) errors.push(`Row ${i + 2}: missing a domain name — skipped.`);
      return;
    }

    rows.push({
      domainName,
      slug: slugify(domainName),
      description: String(get('description') || '').trim(),
      monthlyPrice: cleanMoney(get('monthlyPrice')),
      totalMonths: cleanInt(get('totalMonths')),
      buyNowPrice: cleanMoney(get('buyNowPrice')),
    });
  });

  return { rows, errors };
}

function parseCsv(buffer) {
  const text = buffer.toString('utf8').replace(/^﻿/, '');
  const records = parse(text, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
  return rowsFromRecords(records);
}

async function parseXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { rows: [], errors: ['The workbook has no sheets.'] };

  const records = [];
  let headerRow = null;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = row.values.slice(1).map((v) => {
      if (v && typeof v === 'object' && 'text' in v) return v.text; // rich text
      if (v && typeof v === 'object' && v.result !== undefined) return v.result; // formula
      return v === undefined || v === null ? '' : v;
    });
    if (rowNumber === 1) {
      headerRow = values;
    } else {
      records.push({ __isArray: true, values });
    }
  });

  if (!headerRow) return { rows: [], errors: ['The sheet has no header row.'] };
  const headerMap = buildHeaderMap(headerRow);
  // Reuse rowsFromRecords by faking the header on each record via closure below.
  const fakeFirst = { __isArray: true, values: headerRow };
  return rowsFromRecordsWithHeaderMap([fakeFirst, ...records], headerMap);
}

function rowsFromRecordsWithHeaderMap(records, headerMap) {
  const rows = [];
  const errors = [];
  if (headerMap.domainName === undefined) {
    errors.push('Could not find a "Domain Name" column. Expected headers: Domain Name, Description, Monthly Price, Total Months, Buy Now Price.');
    return { rows, errors };
  }
  records.slice(1).forEach((record, i) => {
    const get = (field) => {
      const idx = headerMap[field];
      return idx === undefined ? undefined : record.values[idx];
    };
    const domainName = cleanDomainName(get('domainName'));
    if (!domainName) {
      const hasOtherData = ['description', 'monthlyPrice', 'totalMonths', 'buyNowPrice'].some((f) => {
        const v = get(f);
        return v !== undefined && String(v).trim() !== '';
      });
      if (hasOtherData) errors.push(`Row ${i + 2}: missing a domain name — skipped.`);
      return;
    }
    rows.push({
      domainName,
      slug: slugify(domainName),
      description: String(get('description') || '').trim(),
      monthlyPrice: cleanMoney(get('monthlyPrice')),
      totalMonths: cleanInt(get('totalMonths')),
      buyNowPrice: cleanMoney(get('buyNowPrice')),
    });
  });
  return { rows, errors };
}

async function parseSpreadsheet(buffer, filename) {
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.csv')) return parseCsv(buffer);
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return parseXlsx(buffer);
  // Fall back: sniff for XLSX zip signature ("PK"), else treat as CSV text.
  if (buffer.length > 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) return parseXlsx(buffer);
  return parseCsv(buffer);
}

module.exports = { parseSpreadsheet };
