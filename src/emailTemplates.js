const { formatMoney } = require('./format');

function contactEmail({ name, email, company, message }) {
  const subject = `New contact form submission — ${name}`;
  const lines = [
    message && message.trim() ? message.trim() : '(No message provided.)',
    '',
    '--',
    `Name: ${name}`,
    `Email: ${email}`,
    `Company / Website: ${company && company.trim() ? company.trim() : '(not provided)'}`,
  ];
  return { subject, text: lines.join('\n') };
}

/**
 * type: 'monthly' | 'buynow'
 */
function domainInquiryEmail({ type, domain, pageUrl, name, email, phone }) {
  let subject;
  let optionLine;

  if (type === 'monthly') {
    const monthly = formatMoney(domain.monthlyPrice);
    const total = domain.monthlyPrice && domain.totalMonths
      ? formatMoney(domain.monthlyPrice * domain.totalMonths)
      : null;
    subject = `Domain Inquiry: ${domain.domainName} — ${monthly}/mo x ${domain.totalMonths} months`;
    optionLine = `Option: Monthly Plan — ${monthly}/mo × ${domain.totalMonths} months${total ? ` (Total ${total})` : ''}`;
  } else {
    const buyNow = formatMoney(domain.buyNowPrice);
    subject = `Domain Inquiry: ${domain.domainName} — Buy Now ${buyNow}`;
    optionLine = `Option: Buy Now — ${buyNow}`;
  }

  const lines = [
    "I'm inquiring about the purchase of this domain name. Please send me the link to pay.",
    '',
    '--',
    `Domain: ${domain.domainName}`,
    optionLine,
    `Page: ${pageUrl}`,
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone && phone.trim() ? phone.trim() : '(not provided)'}`,
  ];

  return { subject, text: lines.join('\n') };
}

module.exports = { contactEmail, domainInquiryEmail };
