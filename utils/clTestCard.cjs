const fs = require('node:fs');
const path = require('node:path');

function getClTestCard(env = process.env) {
  const brand = String(env.CL_TEST_CARD_BRAND || 'mastercard').toLowerCase();
  if (!['mastercard', 'amex'].includes(brand)) throw new Error('CL_TEST_CARD_BRAND must be mastercard or amex.');
  const file = path.resolve(env.CL_TEST_CARD_FILE || 'playwright/.auth/cl-test-card.json');
  const local = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const fixture = local[brand] || {};
  const card = {};
  for (const [field, suffix] of Object.entries({ number: 'NUMBER', holderName: 'HOLDER', expiry: 'EXPIRY', cvv: 'CVV', document: 'DOCUMENT' })) {
    card[field] = String(env[`CL_TEST_CARD_${suffix}`] || fixture[field] || '').trim();
  }
  if (Object.values(card).some(value => !value)) {
    const error = new Error('CL sandbox test card is required via CL_TEST_CARD_* or the ignored CL card fixture.');
    error.code = 'CL_TEST_CARD_DATA_REQUIRED';
    throw error;
  }
  const digits = card.number.replace(/\D/g, '');
  if (!(brand === 'mastercard' ? /^5\d{15}$/.test(digits) : /^3[47]\d{13}$/.test(digits))) {
    throw new Error('CL test-card number does not match the selected brand.');
  }
  return card;
}

module.exports = { getClTestCard };
