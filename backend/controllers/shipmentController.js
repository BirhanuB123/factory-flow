const mongoose = require('mongoose');
const asyncHandler = require('../middleware/asyncHandler');
const Shipment = require('../models/Shipment');
const Order = require('../models/Order');
const Tenant = require('../models/Tenant');
const { formatEthiopianLong, formatEthiopianNumeric } = require('../utils/ethiopianDate');
const { byTenant } = require('../utils/tenantQuery');
const { applyMovement } = require('../services/stockService');
const { consumeOrderLineReservationQuantity } = require('../services/reservationService');

function isReplicaSetError(err) {
  const msg = err && err.message ? String(err.message) : '';
  return (
    msg.includes('replica set') ||
    msg.includes('mongos') ||
    msg.includes('Transaction numbers are only allowed')
  );
}

async function applyShipmentInventoryWithSession(tenantId, shipmentDoc, orderDoc, session) {
  const num = shipmentDoc.shipmentNumber || '';
  for (const ln of shipmentDoc.lines) {
    const idx = ln.lineIndex;
    const q = ln.quantity;
    const item = orderDoc.items[idx];
    const productId = item.product._id || item.product;
    await consumeOrderLineReservationQuantity(
      orderDoc._id,
      idx,
      productId,
      tenantId,
      q,
      session
    );
    await applyMovement(session, {
      tenantId,
      productId,
      delta: -q,
      movementType: 'issue',
      referenceType: 'Shipment',
      referenceId: shipmentDoc._id,
      note: `Shipment ${num} line ${idx}`,
      lotNumber: ln.lotNumber || undefined,
      serialNumber: ln.serialNumber || undefined,
    });
  }
}

async function applyShipmentInventoryWithoutTxn(tenantId, shipmentDoc, orderDoc) {
  const num = shipmentDoc.shipmentNumber || '';
  const done = [];
  try {
    for (const ln of shipmentDoc.lines) {
      const idx = ln.lineIndex;
      const q = ln.quantity;
      const item = orderDoc.items[idx];
      const productId = item.product._id || item.product;
      await applyMovement(null, {
        tenantId,
        productId,
        delta: -q,
        movementType: 'issue',
        referenceType: 'Shipment',
        referenceId: shipmentDoc._id,
        note: `Shipment ${num} line ${idx}`,
        lotNumber: ln.lotNumber || undefined,
        serialNumber: ln.serialNumber || undefined,
      });
      done.push({ productId, q });
    }
    for (const ln of shipmentDoc.lines) {
      const idx = ln.lineIndex;
      const q = ln.quantity;
      const item = orderDoc.items[idx];
      const productId = item.product._id || item.product;
      await consumeOrderLineReservationQuantity(
        orderDoc._id,
        idx,
        productId,
        tenantId,
        q,
        null
      );
    }
  } catch (e) {
    for (const d of done.reverse()) {
      try {
        await applyMovement(null, {
          tenantId,
          productId: d.productId,
          delta: d.q,
          movementType: 'adjustment',
          referenceType: 'Shipment',
          referenceId: shipmentDoc._id,
          note: `Rollback shipment ${num}`,
        });
      } catch (_) {
        /* best-effort */
      }
    }
    throw e;
  }
}

function bumpShippedQuantities(orderDoc, shipmentDoc) {
  for (const ln of shipmentDoc.lines) {
    const idx = ln.lineIndex;
    const q = ln.quantity;
    const item = orderDoc.items[idx];
    const already = Number(item.shippedQty) || 0;
    orderDoc.items[idx].shippedQty = already + q;
  }
}

function refreshOrderShipmentStatus(orderDoc) {
  const allShipped = orderDoc.items.every(
    (it) => (Number(it.shippedQty) || 0) >= it.quantity - 0.0001
  );
  if (allShipped) orderDoc.status = 'shipped';
  else if (orderDoc.status === 'pending') orderDoc.status = 'processing';
}

function nextShipmentNumber() {
  return `SH-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

exports.listShipmentsForOrder = asyncHandler(async (req, res) => {
  const list = await Shipment.find(byTenant(req, { order: req.params.orderId }))
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, data: list });
});

exports.listShipments = asyncHandler(async (req, res) => {
  const list = await Shipment.find(byTenant(req))
    .populate('order', 'status totalAmount')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  res.json({ success: true, data: list });
});

exports.getShipment = asyncHandler(async (req, res) => {
  const s = await Shipment.findOne(byTenant(req, { _id: req.params.id })).populate('order');
  if (!s) return res.status(404).json({ success: false, message: 'Shipment not found' });
  res.json({ success: true, data: s });
});

exports.createShipment = asyncHandler(async (req, res) => {
  const { orderId, lines, carrier, trackingNumber, notes } = req.body;
  if (!orderId || !Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'orderId and lines[{ lineIndex, quantity }] required',
    });
  }
  const order = await Order.findOne(byTenant(req, { _id: orderId }));
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (order.status === 'cancelled') {
    return res.status(400).json({ success: false, message: 'Cannot ship cancelled order' });
  }
  if (order.approvalStatus === 'pending') {
    return res.status(400).json({
      success: false,
      message: 'Order is pending approval; cannot create shipment',
    });
  }
  if (order.approvalStatus === 'rejected') {
    return res.status(400).json({ success: false, message: 'Order was rejected' });
  }

  for (const ln of lines) {
    const idx = Number(ln.lineIndex);
    const q = Number(ln.quantity);
    if (Number.isNaN(idx) || idx < 0 || idx >= order.items.length) {
      return res.status(400).json({ success: false, message: `Invalid lineIndex ${ln.lineIndex}` });
    }
    if (!q || q <= 0) {
      return res.status(400).json({ success: false, message: 'Each line needs quantity > 0' });
    }
    const item = order.items[idx];
    const already = Number(item.shippedQty) || 0;
    const maxQ = item.quantity;
    if (already + q > maxQ + 0.0001) {
      return res.status(400).json({
        success: false,
        message: `Line ${idx}: cannot ship ${q}; only ${maxQ - already} remaining`,
      });
    }
  }

  const s = await Shipment.create({
    tenantId: req.tenantId,
    shipmentNumber: nextShipmentNumber(),
    order: orderId,
    lines: lines.map((l) => ({
      lineIndex: Number(l.lineIndex),
      quantity: Number(l.quantity),
      lotNumber: l.lotNumber || '',
      serialNumber: l.serialNumber || '',
    })),
    status: 'draft',
    carrier: carrier || '',
    trackingNumber: trackingNumber || '',
    notes: notes || '',
  });
  res.status(201).json({ success: true, data: s });
});

exports.updateShipmentStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['draft', 'picked', 'packed', 'shipped'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  const s = await Shipment.findOne(byTenant(req, { _id: req.params.id }));
  if (!s) return res.status(404).json({ success: false, message: 'Shipment not found' });
  if (s.status === 'shipped' && status !== 'shipped') {
    return res.status(400).json({ success: false, message: 'Cannot change shipped shipment' });
  }
  s.status = status;
  await s.save();
  res.json({ success: true, data: s });
});

exports.shipShipment = asyncHandler(async (req, res) => {
  const { carrier, trackingNumber, shippedAt } = req.body;
  const s = await Shipment.findOne(byTenant(req, { _id: req.params.id }));
  if (!s) return res.status(404).json({ success: false, message: 'Shipment not found' });
  if (s.status === 'shipped') {
    return res.status(400).json({ success: false, message: 'Already shipped' });
  }
  const order = await Order.findOne(byTenant(req, { _id: s.order }));
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (order.approvalStatus === 'pending' || order.approvalStatus === 'rejected') {
    return res.status(400).json({
      success: false,
      message: 'Order must be approved before shipping',
    });
  }

  for (const ln of s.lines) {
    const idx = ln.lineIndex;
    const q = ln.quantity;
    const item = order.items[idx];
    if (!item) {
      return res.status(400).json({ success: false, message: `Invalid line ${idx}` });
    }
    const already = Number(item.shippedQty) || 0;
    if (already + q > item.quantity + 0.0001) {
      return res.status(400).json({
        success: false,
        message: `Line ${idx}: over-ship blocked`,
      });
    }
  }

  let fallbackNoTxn = false;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    await applyShipmentInventoryWithSession(req.tenantId, s, order, session);
    bumpShippedQuantities(order, s);
    refreshOrderShipmentStatus(order);
    await order.save({ session });
    s.status = 'shipped';
    s.carrier = carrier != null ? carrier : s.carrier;
    s.trackingNumber = trackingNumber != null ? trackingNumber : s.trackingNumber;
    s.shippedAt = shippedAt ? new Date(shippedAt) : new Date();
    await s.save({ session });
    await session.commitTransaction();
  } catch (e) {
    await session.abortTransaction();
    if (isReplicaSetError(e)) {
      fallbackNoTxn = true;
    } else if (String(e.message || '').includes('Insufficient stock')) {
      return res.status(400).json({ success: false, message: e.message });
    } else {
      throw e;
    }
  } finally {
    session.endSession();
  }

  if (fallbackNoTxn) {
    const orderFb = await Order.findOne(byTenant(req, { _id: s.order }));
    const shipFb = await Shipment.findOne(byTenant(req, { _id: s._id }));
    if (!orderFb || !shipFb) {
      return res.status(500).json({ success: false, message: 'Could not reload order/shipment for ship' });
    }
    await applyShipmentInventoryWithoutTxn(req.tenantId, shipFb, orderFb);
    bumpShippedQuantities(orderFb, shipFb);
    refreshOrderShipmentStatus(orderFb);
    await orderFb.save();
    shipFb.status = 'shipped';
    shipFb.carrier = carrier != null ? carrier : shipFb.carrier;
    shipFb.trackingNumber = trackingNumber != null ? trackingNumber : shipFb.trackingNumber;
    shipFb.shippedAt = shippedAt ? new Date(shippedAt) : new Date();
    await shipFb.save();
    const populatedFb = await Shipment.findOne(byTenant(req, { _id: shipFb._id })).populate('order');
    return res.json({ success: true, data: populatedFb });
  }

  const populated = await Shipment.findOne(byTenant(req, { _id: s._id })).populate('order');
  res.json({ success: true, data: populated });
});

function esc(x) {
  return String(x ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/** Printable delivery note — EN + Amharic labels for warehouse / carrier. */
exports.getDeliveryNoteHtml = asyncHandler(async (req, res) => {
  const s = await Shipment.findOne(byTenant(req, { _id: req.params.id }))
    .populate({
      path: 'order',
      populate: [
        { path: 'client', select: 'name address phone tin' },
        { path: 'items.product', select: 'name sku unit' },
      ],
    })
    .lean();
  
  const tenant = await Tenant.findById(req.tenantId).select('documentSettings legalName').lean();
  const ds = tenant?.documentSettings || {};
  const primaryColor = ds.primaryColor || '#4f46e5';

  if (!s) {
    res.status(404).setHeader('Content-Type', 'text/plain');
    return res.send('Shipment not found');
  }
  const order = s.order;
  const client = order?.client;
  const now = new Date();
  const gDate = now.toLocaleDateString('en-GB');
  const ethLong = formatEthiopianLong(now);
  const ethNum = formatEthiopianNumeric(now);
  const shipAt = s.shippedAt ? new Date(s.shippedAt) : null;
  const shipG = shipAt ? shipAt.toLocaleDateString('en-GB') : '—';
  const shipEth = shipAt ? formatEthiopianNumeric(shipAt) : '—';

  const rows = (s.lines || [])
    .map((ln) => {
      const item = order?.items?.[ln.lineIndex];
      const pr = item?.product;
      const name = pr?.name || `Line ${ln.lineIndex}`;
      const sku = pr?.sku || '—';
      return { sku, name, qty: ln.quantity, unit: pr?.unit || '' };
    })
    .filter(Boolean);

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Delivery ${esc(s.shipmentNumber)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@400;600&display=swap" rel="stylesheet">
<style>
  body{font-family:system-ui,sans-serif;max-width:720px;margin:24px auto;padding:16px;color:#111}
  h1{font-size:1.2rem;margin:0}
  .am{font-family:'Noto Sans Ethiopic',sans-serif;font-size:15px}
  .muted{color:#555;font-size:12px}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th,td{border:1px solid #ccc;padding:8px;text-align:left}
  th{background:#f0f0f0;font-size:11px;border-top:2px solid ${primaryColor}}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .header-table{width:100%;border:none;margin-bottom:20px}
  .header-table td{border:none;padding:0;vertical-align:top}
  .logo{max-height:60px;margin-bottom:10px}
  @media print{.no-print{display:none}}
</style></head><body>
  <p class="no-print"><a href="#" onclick="window.print();return false">Print</a></p>
  
  <table class="header-table">
    <tr>
      <td>
        ${ds.logoUrl ? `<img src="${esc(ds.logoUrl)}" class="logo" />` : `<h1>${esc(tenant?.legalName || 'Integra ERP')}</h1>`}
      </td>
      <td style="text-align:right">
        <h1 style="color:${primaryColor}">${esc(ds.dnHeader || 'Delivery Note')} <span class="am">/ የመላኪያ ማስረጃ</span></h1>
        <p class="muted"># ${esc(s.shipmentNumber)}</p>
      </td>
    </tr>
  </table>

  <p class="muted">Gregorian: ${esc(gDate)} &nbsp;|&nbsp; Ethiopian: ${esc(ethLong)} (${esc(ethNum)})</p>
  <p><strong>Shipment / ሹፌራ</strong> ${esc(s.shipmentNumber)}<br/>
  <strong>Order</strong> ${esc(String(order?._id || '').slice(-8))}<br/>
  ${shipAt ? `<strong>Shipped / ተላከ</strong> ${esc(shipG)} (EC ${esc(shipEth)})<br/>` : ''}
  <strong>Carrier / ጭነት</strong> ${esc(s.carrier || '—')} &nbsp;
  <strong>Tracking</strong> ${esc(s.trackingNumber || '—')}</p>
  <hr/>
  <p><strong>Ship to / ለ</strong><br/>
  <span class="am">${esc(client?.name || '—')}</span><br/>
  ${esc(client?.address || '')}<br/>
  Tel: ${esc(client?.phone || '—')}</p>
  <table>
    <tr>
      <th>SKU</th>
      <th>Product<br/><span class="am">ምርት</span></th>
      <th class="num">Qty<br/><span class="am">ብዛት</span></th>
    </tr>
    ${rows
      .map(
        (r) =>
          `<tr><td class="font-mono">${esc(r.sku)}</td><td>${esc(r.name)}</td><td class="num">${esc(r.qty)} ${esc(r.unit)}</td></tr>`
      )
      .join('')}
  </table>
  <p class="muted" style="margin-top:32px">Receiver signature / ተቀባይ ፊርማ: _______________________ &nbsp; Date / ቀን: __________</p>
  ${ds.footerText ? `<div style="margin-top:40px;padding-top:10px;border-top:1px solid #eee;font-size:10px;color:#888">${esc(ds.footerText)}</div>` : ''}
</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});
