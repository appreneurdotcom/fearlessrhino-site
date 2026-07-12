// Shared primary navigation, in display order. `key` is matched against the
// `active` value each route passes to res.render() to highlight the current item.
module.exports = [
  { key: 'services', label: 'Services', href: '/services' },
  { key: 'applications', label: 'Applications', href: '/apps' },
  { key: 'results', label: 'Results', href: '/results' },
  { key: 'pricing', label: 'Pricing', href: '/pricing' },
  { key: 'blog', label: 'Blog', href: '/blog' },
  { key: 'domains', label: 'Domain Names', href: '/domains' },
  { key: 'about', label: 'About', href: '/about' },
];
