const asyncHandler = require('../middleware/asyncHandler');
const Shipment = require('../models/Shipment');
const Order = require('../models/Order');
const { formatEthiopianLong, formatEthiopianNumeric } = require('../utils/ethiopianDate');

function nextShipmentNumber() {
  return `SH-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

exports.listShipmentsForOrder = asyncHandler(async (req, res) => {
  const list = await Shipment.find({ order: req.params.orderId })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, data: list });
});

exports.listShipments = asyncHandler(async (req, res) => {
  const list = await Shipment.find()
    .populate('order', 'status totalAmount')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  res.json({ success: true, data: list });
});

exports.getShipment = asyncHandler(async (req, res) => {
  const s = await Shipment.findById(req.params.id).populate('order');
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
  const order = await Order.findById(orderId);
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
    shipmentNumber: nextShipmentNumber(),
    order: orderId,
    lines: lines.map((l) => ({
      lineIndex: Number(l.lineIndex),
      quantity: Number(l.quantity),
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
  const s = await Shipment.findById(req.params.id);
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
  const s = await Shipment.findById(req.params.id);
  if (!s) return res.status(404).json({ success: false, message: 'Shipment not found' });
  if (s.status === 'shipped') {
    return res.status(400).json({ success: false, message: 'Already shipped' });
  }
  const order = await Order.findById(s.order);
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
    order.items[idx].shippedQty = already + q;
  }

  const allShipped = order.items.every(
    (it) => (Number(it.shippedQty) || 0) >= it.quantity - 0.0001
  );
  if (allShipped) order.status = 'shipped';
  else if (order.status === 'pending') order.status = 'processing';

  await order.save();

  s.status = 'shipped';
  s.carrier = carrier != null ? carrier : s.carrier;
  s.trackingNumber = trackingNumber != null ? trackingNumber : s.trackingNumber;
  s.shippedAt = shippedAt ? new Date(shippedAt) : new Date();
  await s.save();

  const populated = await Shipment.findById(s._id).populate('order');
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
  const s = await Shipment.findById(req.params.id)
    .populate({
      path: 'order',
      populate: [
        { path: 'client', select: 'name address phone tin' },
        { path: 'items.product', select: 'name sku unit' },
      ],
    })
    .lean();
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
  th{background:#f0f0f0;font-size:11px}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  @media print{.no-print{display:none}}
</style></head><body>
  <p class="no-print"><a href="#" onclick="window.print();return false">Print</a></p>
  <h1>Delivery note <span class="am">/ የመላኪያ ማስረጃ</span></h1>
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
</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});
