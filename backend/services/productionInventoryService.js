const mongoose = require('mongoose');
const BOM = require('../models/BOM');
const ProductionJob = require('../models/ProductionJob');
const Product = require('../models/Product');
const { applyMovement } = require('./stockService');
const { consumeJobMaterialReservations } = require('./reservationService');

function tid(tenantId) {
  return new mongoose.Types.ObjectId(tenantId);
}

function isReplicaSetError(err) {
  const msg = err && err.message ? String(err.message) : '';
  return (
    msg.includes('replica set') ||
    msg.includes('mongos') ||
    msg.includes('Transaction numbers are only allowed')
  );
}

async function postProductionCompletionWithoutTxn(job, bom, jobQty) {
  const tenantOid = tid(job.tenantId);
  const consumes = [];
  for (const c of bom.components) {
    const pid = c.product._id || c.product;
    const need = c.quantity * jobQty;
    if (need > 0) consumes.push({ productId: pid, need });
  }

  for (const { productId, need } of consumes) {
    const p = await Product.findOne({ _id: productId, tenantId: tenantOid });
    if (!p || p.stock < need) {
      throw new Error(
        `Insufficient stock for ${p ? p.sku : productId}: need ${need}, have ${p ? p.stock : 0}`
      );
    }
  }

  const done = [];
  try {
    for (const { productId, need } of consumes) {
      await applyMovement(null, {
        tenantId: job.tenantId,
        productId,
        delta: -need,
        movementType: 'production_consume',
        referenceType: 'ProductionJob',
        referenceId: job._id,
        note: `Job ${job.jobId}`,
      });
      done.push({ productId, delta: -need });
    }
    await applyMovement(null, {
      tenantId: job.tenantId,
      productId: bom.outputProduct,
      delta: jobQty,
      movementType: 'production_output',
      referenceType: 'ProductionJob',
      referenceId: job._id,
      note: `Job ${job.jobId}`,
    });
    done.push({ productId: bom.outputProduct, delta: jobQty });
  } catch (e) {
    for (const d of done.reverse()) {
      try {
        await applyMovement(null, {
          tenantId: job.tenantId,
          productId: d.productId,
          delta: -d.delta,
          movementType: 'adjustment',
          referenceType: 'ProductionJob',
          referenceId: job._id,
          note: `Rollback failed job ${job.jobId}`,
        });
      } catch (_) {
        /* best-effort */
      }
    }
    throw e;
  }
}

async function postProductionCompletion(job) {
  const bom = await BOM.findOne({
    _id: job.bom,
    tenantId: tid(job.tenantId),
  }).populate('components.product');
  if (!bom) {
    throw new Error('BOM not found');
  }
  if (!bom.outputProduct) {
    throw new Error(
      'BOM has no output product. Edit the BOM and assign the finished-good SKU before completing the job.'
    );
  }

  const now = new Date();
  if (bom.effectiveFrom && now < new Date(bom.effectiveFrom)) {
    throw new Error('This BOM is not yet effective (effectiveFrom is in the future)');
  }
  if (bom.effectiveTo && now > new Date(bom.effectiveTo)) {
    throw new Error('This BOM is past its effective end date (effectiveTo)');
  }

  await consumeJobMaterialReservations(job._id, job.tenantId);

  const jobQty = job.quantity;
  let posted = false;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    for (const c of bom.components) {
      const pid = c.product._id || c.product;
      const need = c.quantity * jobQty;
      if (need > 0) {
        await applyMovement(session, {
          tenantId: job.tenantId,
          productId: pid,
          delta: -need,
          movementType: 'production_consume',
          referenceType: 'ProductionJob',
          referenceId: job._id,
          note: `Job ${job.jobId}`,
        });
      }
    }
    await applyMovement(session, {
      tenantId: job.tenantId,
      productId: bom.outputProduct,
      delta: jobQty,
      movementType: 'production_output',
      referenceType: 'ProductionJob',
      referenceId: job._id,
      note: `Job ${job.jobId}`,
    });
    await session.commitTransaction();
    posted = true;
  } catch (e) {
    await session.abortTransaction();
    if (isReplicaSetError(e)) {
      await postProductionCompletionWithoutTxn(job, bom, jobQty);
      posted = true;
    } else {
      throw e;
    }
  } finally {
    session.endSession();
  }

  if (posted) {
    await ProductionJob.findOneAndUpdate(
      { _id: job._id, tenantId: tid(job.tenantId) },
      { inventoryPosted: true }
    );
  }
}

module.exports = { postProductionCompletion };
