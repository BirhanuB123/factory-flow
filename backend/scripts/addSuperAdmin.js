/**
 * Script to create an additional super-admin or promote an existing employee to super-admin.
 *
 * Usage:
 *   node scripts/addSuperAdmin.js <email> <password> [name] [employeeId]
 * Or using environment variables:
 *   SUPER_ADMIN_EMAIL=admin@example.com SUPER_ADMIN_PASSWORD=MyPassword123! node scripts/addSuperAdmin.js
 */

require('../config/loadEnv');

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Tenant = require('../models/Tenant');
const Employee = require('../models/Employee');

async function main() {
  const args = process.argv.slice(2);
  const email = (args[0] || process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = args[1] || process.env.SUPER_ADMIN_PASSWORD || '';
  const name = (args[2] || process.env.SUPER_ADMIN_NAME || 'Super Admin').trim();
  const employeeId = (args[3] || process.env.SUPER_ADMIN_EMPLOYEE_ID || `SA-${Date.now().toString().slice(-4)}`).trim();

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    console.error('Error: A valid email address is required.');
    console.log('Usage: node scripts/addSuperAdmin.js <email> <password> [name] [employeeId]');
    process.exit(1);
  }

  if (!password || password.length < 8) {
    console.error('Error: A password of at least 8 characters is required.');
    console.log('Usage: node scripts/addSuperAdmin.js <email> <password> [name] [employeeId]');
    process.exit(1);
  }

  await connectDB();

  try {
    let tenant = await Tenant.findOne({ key: 'default' });
    if (!tenant) {
      tenant = await Tenant.findOne();
    }
    if (!tenant) {
      throw new Error('No tenant found in the database. Please ensure default tenant exists.');
    }

    // Check if user already exists
    let user = await Employee.findOne({ email });

    if (user) {
      user.platformRole = 'super_admin';
      user.role = 'Admin';
      user.status = 'Active';
      user.password = password; // pre('save') hook will hash it
      user.mustChangePassword = false;
      await user.save();
      console.log(`✅ Success: Existing user "${email}" promoted to super_admin with updated password.`);
    } else {
      user = await Employee.create({
        tenantId: tenant._id,
        platformRole: 'super_admin',
        employeeId,
        name,
        role: 'Admin',
        department: 'Platform',
        status: 'Active',
        email,
        password,
        mustChangePassword: false,
      });
      console.log(`✅ Success: Created new super_admin account for "${email}" (Employee ID: ${employeeId}).`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Failed to create super-admin:', err.message);
  process.exit(1);
});
