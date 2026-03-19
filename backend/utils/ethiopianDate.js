const { toEthiopian } = require('ethiopian-calendar-new');

const ETH_MONTHS = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miazia',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehasse',
  'Pagume',
];

/** @param {Date|string|number} d */
function formatEthiopianLong(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const e = toEthiopian(x.getFullYear(), x.getMonth() + 1, x.getDate());
  const m = ETH_MONTHS[e.month - 1] || `M${e.month}`;
  return `${m} ${e.day}, ${e.year} E.C.`;
}

/** ISO-style DD/MM/EC year */
function formatEthiopianNumeric(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const e = toEthiopian(x.getFullYear(), x.getMonth() + 1, x.getDate());
  return `${String(e.day).padStart(2, '0')}/${String(e.month).padStart(2, '0')}/${e.year}`;
}

module.exports = { formatEthiopianLong, formatEthiopianNumeric, toEthiopian, ETH_MONTHS };
