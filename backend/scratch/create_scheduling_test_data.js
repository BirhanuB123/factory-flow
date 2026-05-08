const mongoose = require('mongoose');
const ProductionJob = require('../models/ProductionJob');
const BOM = require('../models/BOM');
require('dotenv').config();

async function createTestData() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const bom = await BOM.findOne({});
  if (!bom) {
    console.log('No BOM found');
    process.exit(0);
  }

  const tenantId = bom.tenantId;
  const today = new Date();
  today.setHours(8, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const testJobs = [
    {
      tenantId,
      jobId: `TEST-MAY6-A`,
      bom: bom._id,
      quantity: 10,
      status: 'Scheduled',
      priority: 'High',
      plannedStartDate: today,
      dueDate: new Date(today.getTime() + 24 * 60 * 60 * 1000), // +1 day
      workCenterCode: 'WC-01',
      travelerToken: `TOKEN-${Date.now()}-A`
    },
    {
      tenantId,
      jobId: `TEST-MAY6-B`,
      bom: bom._id,
      quantity: 5,
      status: 'In Progress',
      priority: 'Urgent',
      plannedStartDate: today,
      dueDate: new Date(today.getTime() + 48 * 60 * 60 * 1000), // +2 days
      workCenterCode: 'WC-02',
      travelerToken: `TOKEN-${Date.now()}-B`
    },
    {
      tenantId,
      jobId: `TEST-MAY7-C`,
      bom: bom._id,
      quantity: 20,
      status: 'Scheduled',
      priority: 'Medium',
      plannedStartDate: tomorrow,
      dueDate: new Date(tomorrow.getTime() + 72 * 60 * 60 * 1000), // +3 days
      workCenterCode: 'WC-01',
      travelerToken: `TOKEN-${Date.now()}-C`
    }
  ];

  try {
    await ProductionJob.deleteMany({ jobId: { $regex: /^TEST-MAY/ } });
    await ProductionJob.insertMany(testJobs);
    console.log('Created 3 test jobs for May 6th and 7th');
  } catch (err) {
    console.error('Error creating test data:', err);
  }
  
  mongoose.connection.close();
}

createTestData();
