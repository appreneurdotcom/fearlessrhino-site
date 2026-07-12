/** Turn "Example.com" into "example-com" for use in URLs. */
function slugify(domainName) {
  return String(domainName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = { slugify };
