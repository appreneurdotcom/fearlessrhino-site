function formatMoney(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return null;
  const isWhole = Math.round(amount * 100) % 100 === 0;
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

module.exports = { formatMoney };
