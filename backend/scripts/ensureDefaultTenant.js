/**
 * One-time (or idempotent) migration: default tenant + backfill tenantId on collections.
 *
 * Run from backend folder:
 *   npm run migrate:tenant
 *
 * Phase 1+2: extends backfill to manufacturing, inventory ledger, finance, HR, etc.
 * Drops legacy unique indexes when present (names are typical MongoDB defaults).
 */

require('../config/loadEnv');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Tenant = require('../models/Tenant');
const { defaultModuleFlagsObject } = require('../utils/tenantModules');

async function dropIndexIfExists(collectionName, indexName) {
  try {
    await mongoose.connection.collection(collectionName).dropIndex(indexName);
    // eslint-disable-next-line no-console
    console.log(`Dropped index ${collectionName}.${indexName}`);
  } catch (e) {
    if (e.code === 27 || e.codeName === 'IndexNotFound' || String(e.message).includes('index not found')) {
      return;
    }
    // eslint-disable-next-line no-console
    console.warn(`Could not drop ${collectionName}.${indexName}:`, e.message);
  }
}

async function main() {
  await connectDB();

  let tenant = await Tenant.findOne({ key: 'default' });
  if (!tenant) {
    tenant = await Tenant.create({
      key: 'default',
      legalName: 'Default Company',
      displayName: 'Default Company',
      status: 'active',
    });
    // eslint-disable-next-line no-console
    console.log('Created default tenant', tenant._id.toString());
  } else {
    // eslint-disable-next-line no-console
    console.log('Using existing default tenant', tenant._id.toString());
  }

  const defaultFlags = defaultModuleFlagsObject();
  try {
    const mf = await Tenant.updateMany(
      { 'moduleFlags.manufacturing': { $exists: false } },
      { $set: { moduleFlags: defaultFlags } }
    );
    // eslint-disable-next-line no-console
    console.log(
      `Tenants moduleFlags backfill: matched ${mf.matchedCount}, modified ${mf.modifiedCount}`
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('moduleFlags backfill:', e.message);
  }
  try {
    const sr = await Tenant.updateMany(
      { statusReason: { $exists: false } },
      { $set: { statusReason: '' } }
    );
    // eslint-disable-next-line no-console
    console.log(`Tenants statusReason backfill: matched ${sr.matchedCount}, modified ${sr.modifiedCount}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('statusReason backfill:', e.message);
  }
  try {
    const act = await Tenant.updateMany(
      { lastApiActivityAt: { $exists: false } },
      { $set: { lastApiActivityAt: null } }
    );
    // eslint-disable-next-line no-console
    console.log(
      `Tenants lastApiActivityAt backfill: matched ${act.matchedCount}, modified ${act.modifiedCount}`
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('lastApiActivityAt backfill:', e.message);
  }
  try {
    const ted = await Tenant.updateMany(
      { trialEndDate: { $exists: false } },
      { $set: { trialEndDate: null } }
    );
    // eslint-disable-next-line no-console
    console.log(`Tenants trialEndDate backfill: matched ${ted.matchedCount}, modified ${ted.modifiedCount}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('trialEndDate backfill:', e.message);
  }

  const tid = tenant._id;

  const collections = [
    'employees',
    'products',
    'clients',
    'orders',
    'boms',
    'productionjobs',
    'stockmovements',
    'stockreservations',
    'purchaseorders',
    'shipments',
    'invoices',
    'expenses',
    'vendors',
    'vendorbills',
    'vendorpayments',
    'cogsentries',
    'withholdingcertificates',
    'taxsettings',
    'attendances',
    'payrolls',
    'auditlogs',
    'approvalrequests',
    'savedviews',
    'notifications',
    'workcenters',
    'assets',
    'pmschedules',
    'downtimeevents',
    'qualityinspections',
    'nonconformances',
  ];

  for (const coll of collections) {
    try {
      const r = await mongoose.connection.collection(coll).updateMany(
        { $or: [{ tenantId: { $exists: false } }, { tenantId: null }] },
        { $set: { tenantId: tid } }
      );
      // eslint-disable-next-line no-console
      console.log(`${coll}: matched ${r.matchedCount}, modified ${r.modifiedCount}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`Skip or warn ${coll}:`, e.message);
    }
  }

  await dropIndexIfExists('products', 'sku_1');
  await dropIndexIfExists('employees', 'employeeId_1');
  await dropIndexIfExists('boms', 'partNumber_1');
  await dropIndexIfExists('productionjobs', 'jobId_1');
  await dropIndexIfExists('purchaseorders', 'poNumber_1');
  await dropIndexIfExists('shipments', 'shipmentNumber_1');
  await dropIndexIfExists('invoices', 'invoiceId_1');
  await dropIndexIfExists('vendors', 'code_1');
  await dropIndexIfExists('vendorbills', 'billNumber_1');
  await dropIndexIfExists('cogsentries', 'invoice_1');
  await dropIndexIfExists('withholdingcertificates', 'certificateNumber_1');
  await dropIndexIfExists('taxsettings', 'key_1');
  await dropIndexIfExists('workcenters', 'code_1');
  await dropIndexIfExists('assets', 'code_1');
  await dropIndexIfExists('nonconformances', 'ncNumber_1');
  await dropIndexIfExists('savedviews', 'user_1_module_1_name_1');
  await dropIndexIfExists('payrolls', 'employee_1_month_1');

  // eslint-disable-next-line no-console
  console.log('Done. Restart the API server.');
  process.exit(0);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
