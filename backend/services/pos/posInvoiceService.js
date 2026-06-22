const Invoice = require('../../models/Invoice');
const Client = require('../../models/Client');
const {
  getTaxSettings,
  computeSalesInvoiceTax,
  allocateNextInvoiceNumber,
} = require('../ethiopiaTaxService');

/**
 * Creates a formal Invoice for a completed POS sale.
 *
 * Invoice number is allocated atomically (outside the mongo session) before the
 * Invoice document is written inside the caller's session. A gap in the sequence
 * is acceptable if the surrounding transaction aborts — numbers are never reused.
 *
 * @param {object} opts
 * @param {mongoose.Types.ObjectId} opts.tenantId
 * @param {object}  opts.order          - Mongoose Order document
 * @param {object}  [opts.mongoSession] - Active mongoose session for atomicity
 */
async function createPosInvoice({ tenantId, order, mongoSession }) {
  // Allocate the sequential invoice number outside the transaction (atomic $inc on TaxSettings)
  const invoiceId = await allocateNextInvoiceNumber(tenantId);

  const [settings, client] = await Promise.all([
    getTaxSettings(tenantId),
    order.client
      ? Client.findById(order.client).select('vatRegistered tin').lean()
      : Promise.resolve(null),
  ]);

  // Walk-in customers are treated as VAT-registered buyers but never withhold tax
  const taxResult = computeSalesInvoiceTax(
    order.totalAmount,
    client || { vatRegistered: true },
    settings,
    { forceWhtRate: client ? undefined : 0 },
  );

  const today = new Date();

  const lines = order.items.map((item) => ({
    product: item.product?._id ?? item.product,
    quantity: item.quantity,
    unitPrice: item.price,
    sku: '',
  }));

  const createOpts = mongoSession ? { session: mongoSession } : {};
  const [invoice] = await Invoice.create(
    [
      {
        tenantId,
        client: order.client || null,
        invoiceId,
        amount: taxResult.netPayable,
        amountTaxable: taxResult.taxableAmount,
        vatRate: taxResult.vatRate,
        vatAmount: taxResult.vatAmount,
        salesWhtRate: taxResult.salesWhtRate,
        salesWhtAmount: taxResult.salesWhtAmount,
        grossBeforeWht: taxResult.grossBeforeWht,
        sellerTinSnapshot: settings.companyTIN || '',
        buyerTinSnapshot: client?.tin || '',
        status: 'Paid',
        dueDate: today,
        invoiceDate: today,
        description: `POS Sale — ${invoiceId}`,
        order: order._id,
        lines,
      },
    ],
    createOpts,
  );

  return invoice;
}

module.exports = { createPosInvoice };
