/**
 * One-time, guarded bootstrap for the first platform super-admin.
 *
 * Run only after `npm run migrate:tenant` has created the default tenant.
 * Required environment variables:
 *   BOOTSTRAP_CONFIRM=CREATE_INITIAL_SUPER_ADMIN
 *   BOOTSTRAP_ADMIN_EMAIL=admin@example.com
 *   BOOTSTRAP_ADMIN_PASSWORD=<at least 12 characters; value is not trimmed>
 * Optional:
 *   BOOTSTRAP_ADMIN_NAME=Platform Super Admin
 *   BOOTSTRAP_ADMIN_EMPLOYEE_ID=PLATFORM-SUPER-ADMIN
 *
 * The script refuses to run if any super-admin or a conflicting login identity
 * already exists. It never logs the password.
 */

require('../config/loadEnv');

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Tenant = require('../models/Tenant');
const Employee = require('../models/Employee');

const CONFIRMATION = 'CREATE_INITIAL_SUPER_ADMIN';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function getConfiguration() {
  if (process.env.BOOTSTRAP_CONFIRM !== CONFIRMATION) {
    throw new Error(`Set BOOTSTRAP_CONFIRM=${CONFIRMATION} to run this one-time command.`);
  }

  const email = required('BOOTSTRAP_ADMIN_EMAIL').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid email address.');
  }

  const password = required('BOOTSTRAP_ADMIN_PASSWORD');
  if (password.length < 12 || password.length > 128) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be between 12 and 128 characters.');
  }

  const name = String(process.env.BOOTSTRAP_ADMIN_NAME || 'Platform Super Admin').trim();
  const employeeId = String(
    process.env.BOOTSTRAP_ADMIN_EMPLOYEE_ID || 'PLATFORM-SUPER-ADMIN'
  ).trim();
  if (!name || !employeeId) {
    throw new Error('BOOTSTRAP_ADMIN_NAME and BOOTSTRAP_ADMIN_EMPLOYEE_ID cannot be blank.');
  }

  return { email, password, name, employeeId };
}

async function main() {
  const { email, password, name, employeeId } = getConfiguration();
  await connectDB();

  try {
    const defaultTenant = await Tenant.findOne({ key: 'default' });
    if (!defaultTenant) {
      throw new Error('Default tenant not found. Run `npm run migrate:tenant` first.');
    }

    const existingSuperAdmin = await Employee.exists({ platformRole: 'super_admin' });
    if (existingSuperAdmin) {
      throw new Error('A platform super-admin already exists. This bootstrap command will not create another.');
    }

    // Login is global by email or employee ID, so both identities must be globally unique.
    const conflictingUser = await Employee.findOne({
      $or: [{ email }, { employeeId }],
    })
      .select('_id email employeeId')
      .lean();
    if (conflictingUser) {
      throw new Error('The requested email or employee ID is already in use. Choose unique bootstrap values.');
    }

    const user = await Employee.create({
      tenantId: defaultTenant._id,
      platformRole: 'super_admin',
      employeeId,
      name,
      role: 'Admin',
      department: 'Platform',
      status: 'Active',
      email,
      password,
      mustChangePassword: true,
    });

    // eslint-disable-next-line no-console
    console.log(`Created the initial platform super-admin (${user._id}). Change its password at first login.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`Super-admin bootstrap failed: ${error.message}`);
  process.exitCode = 1;
});
