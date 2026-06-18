const JournalEntry = require('../../models/JournalEntry');
const Product = require('../../models/Product');

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

const PAYMENT_DR_ACCOUNT = {
  cash:   '1110 — Cash in hand (POS till)',
  card:   '1120 — Card receivables (POS)',
  mobile: '1130 — Mobile money receivable',
  chapa:  '1130 — Mobile money receivable',
  other:  '1130 — Mobile money receivable',
};

/**
 * Posts a double-entry journal for a completed POS sale.
 *
 * Revenue side (single payment):
 *   DR  Cash / Card / Mobile (based on payment method)
 *   CR  Sales revenue
 *
 * Revenue side (split payment):
 *   DR  Cash in hand        (cash portion)
 *   DR  Card receivables    (card portion)
 *   DR  Mobile money        (mobile portion)
 *   CR  Sales revenue       (full total)
 *
 * COGS side (when product has a unitCost):
 *   DR  Cost of goods sold
 *   CR  Inventory
 *
 * @param {object} opts
 * @param {mongoose.Types.ObjectId} opts.tenantId
 * @param {object}  opts.order          - Mongoose Order document
 * @param {Array}   [opts.splitPayments] - [{method, amount}] for split sales
 * @param {object}  [opts.mongoSession]  - Active mongoose session for atomicity
 */
async function createPosSaleJournal({ tenantId, order, splitPayments, mongoSession }) {
  const method = order.paymentDetails?.method || 'cash';
  const saleAmount = round2(order.totalAmount);
  const receiptRef = String(order._id).slice(-8).toUpperCase();

  // Build debit lines — one per payment method
  const debitLines = [];
  if (method === 'split' && Array.isArray(splitPayments) && splitPayments.length > 0) {
    for (const p of splitPayments) {
      const acct = PAYMENT_DR_ACCOUNT[p.method] || PAYMENT_DR_ACCOUNT.other;
      const existing = debitLines.find((l) => l.account === acct);
      if (existing) {
        existing.debit = round2(existing.debit + p.amount);
      } else {
        debitLines.push({ account: acct, debit: round2(p.amount), credit: 0, memo: `POS receipt (${p.method}) — #${receiptRef}` });
      }
    }
  } else {
    const drAccount = PAYMENT_DR_ACCOUNT[method] || PAYMENT_DR_ACCOUNT.other;
    debitLines.push({ account: drAccount, debit: saleAmount, credit: 0, memo: `POS receipt — #${receiptRef}` });
  }

  const lines = [
    ...debitLines,
    {
      account: '4100 — Sales revenue',
      debit: 0,
      credit: saleAmount,
      memo: `POS sale — #${receiptRef}`,
    },
  ];

  // COGS lines — look up each product's unitCost at time of sale
  let totalCogs = 0;
  for (const item of order.items) {
    const productId = item.product?._id ?? item.product;
    const product = await Product.findById(productId)
      .select('unitCost')
      .session(mongoSession ?? null)
      .lean();

    if (product?.unitCost > 0) {
      totalCogs = round2(totalCogs + product.unitCost * item.quantity);
    }
  }

  if (totalCogs > 0) {
    lines.push(
      {
        account: '5100 — Cost of goods sold',
        debit: totalCogs,
        credit: 0,
        memo: `COGS — POS sale #${receiptRef}`,
      },
      {
        account: '1300 — Inventory',
        debit: 0,
        credit: totalCogs,
        memo: `COGS — POS sale #${receiptRef}`,
      },
    );
  }

  const createOpts = mongoSession ? { session: mongoSession } : {};
  const [je] = await JournalEntry.create(
    [
      {
        tenantId,
        entryDate: new Date(),
        memo: method === 'split' ? `POS Sale #${receiptRef} — split payment` : `POS Sale #${receiptRef} — ${method}`,
        source: 'pos',
        sourceRef: String(order._id),
        lines,
      },
    ],
    createOpts,
  );

  return je;
}

module.exports = { createPosSaleJournal };
