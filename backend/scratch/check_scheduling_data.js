const mongoose = require('mongoose');
const ProductionJob = require('../models/ProductionJob');
require('dotenv').config();

async function checkData() {
  await mongoose.connect(process.env.MONGODB_URI);
  const activeJobs = await ProductionJob.find({ status: { $in: ['Scheduled', 'In Progress'] } });
  console.log(`Found ${activeJobs.length} active jobs:`);
  activeJobs.forEach(j => {
    console.log(`Job: ${j.jobId}, Status: ${j.status}, Start: ${j.plannedStartDate}, CreatedAt: ${j.createdAt}, Due: ${j.dueDate}`);
  });
  mongoose.connection.close();
}

checkData();
