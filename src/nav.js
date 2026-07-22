// Shared primary navigation, in display order. `key` is matched against the
// `active` value each route passes to res.render() to highlight the current item.
module.exports = [
  { key: 'services', label: 'Services', href: '/services' },
  { key: 'applications', label: 'Applications', href: '/apps' },
  { key: 'results', label: 'Results', href: '/results' },
  // Pricing and Blog are hidden for now (still fully built — see server.js
  // and footer.ejs for the matching hidden entries). Restore all three
  // together to bring them back.
  { key: 'domains', label: 'Domain Names', href: '/domains' },
  { key: 'about', label: 'About', href: '/about' },
];
