/**
 * Landed cost (freight, duty, clearing) allocated to PO lines → inventory unit cost in functional currency (ETB).
 * Line unit costs are in invoice currency; multiply by fxRateToFunctional for stock valuation.
 */

function functionalUnitCost(lineUnitCost, fxRate) {
  const fx = Number(fxRate) > 0 ? Number(fxRate) : 1;
  return (Number(lineUnitCost) || 0) * fx;
}

/**
 * @param {object} po - PurchaseOrder doc (plain or mongoose) with lines, importFreight, etc.
 * @returns {{ lineIndex: number, baseFunctional: number, landedPerUnit: number, inventoryUnitCost: number }[]}
 */
function computeLineInventoryUnitCosts(po) {
  const lines = po.lines || [];
  const fx = Number(po.fxRateToFunctional) > 0 ? Number(po.fxRateToFunctional) : 1;
  const pool =
    (Number(po.importFreight) || 0) +
    (Number(po.importDuty) || 0) +
    (Number(po.importClearing) || 0);
  const method = po.landedCostAllocation || 'none';

  const qty = lines.map((l) => Math.max(0, Number(l.quantityOrdered) || 0));
  const base = lines.map((l) => functionalUnitCost(l.unitCost, fx));
  let landedPerUnit = lines.map(() => 0);

  if (method !== 'none' && pool > 0 && lines.length > 0) {
    if (method === 'by_quantity') {
      const totalQ = qty.reduce((a, b) => a + b, 0);
      if (totalQ > 0) {
        const per = pool / totalQ;
        landedPerUnit = qty.map((q) => (q > 0 ? per : 0));
      }
    } else if (method === 'by_value') {
      const weights = lines.map((l, i) => qty[i] * (Number(l.unitCost) || 0));
      const totalW = weights.reduce((a, b) => a + b, 0);
      if (totalW > 0) {
        landedPerUnit = lines.map((_, i) => {
          const q = qty[i];
          if (q <= 0) return 0;
          return (pool * weights[i]) / totalW / q;
        });
      } else {
        const totalQ = qty.reduce((a, b) => a + b, 0);
        if (totalQ > 0) {
          const per = pool / totalQ;
          landedPerUnit = qty.map((q) => (q > 0 ? per : 0));
        }
      }
    }
  }

  return lines.map((_, i) => {
    const inv = base[i] + landedPerUnit[i];
    return {
      lineIndex: i,
      baseFunctional: round4(base[i]),
      landedPerUnit: round4(landedPerUnit[i]),
      inventoryUnitCost: round4(inv),
    };
  });
}

function round4(n) {
  return Math.round(Number(n) * 10000) / 10000;
}

module.exports = { computeLineInventoryUnitCosts, functionalUnitCost };
