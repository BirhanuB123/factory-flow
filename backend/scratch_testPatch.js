require('./config/loadEnv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Tenant = require('./models/Tenant');
const { mergeModuleFlagsPatch } = require('./utils/tenantModules');

async function main() {
  await connectDB();
  const tenant = await Tenant.findOne({ key: 'default' });
  if (!tenant) {
    console.log('No default tenant found.');
    process.exit(1);
  }
  console.log('Existing moduleFlags:', tenant.moduleFlags);

  const newFlags = mergeModuleFlagsPatch(tenant.moduleFlags, { global_trade: false, crm: false });
  console.log('Merged flags to set:', newFlags);

  tenant.moduleFlags = newFlags;
  // Mark path as modified since it is a nested object
  tenant.markModified('moduleFlags');
  await tenant.save();

  const refreshed = await Tenant.findById(tenant._id);
  console.log('Refreshed moduleFlags from DB:', refreshed.moduleFlags);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
