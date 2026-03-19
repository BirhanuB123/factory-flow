const { randomUUID } = require('crypto');

/**
 * @param {import('mongoose').Document|null} bomLean
 * @param {number} jobQty
 */
function buildOperationsFromBom(bom, jobQty) {
  const qty = Math.max(1, Number(jobQty) || 1);
  const routing = bom?.routing;
  if (Array.isArray(routing) && routing.length > 0) {
    return [...routing]
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
      .map((r) => ({
        sequence: r.sequence ?? 0,
        code: r.code || 'OP',
        name: r.name || r.code || 'Operation',
        workCenterCode: r.workCenterCode || '',
        status: 'pending',
        plannedSetupMin: Number(r.setupMinutes) || 0,
        plannedRunMin: (Number(r.runMinutesPerUnit) || 0) * qty,
        actualLaborMin: 0,
        scrapQty: 0,
        reworkQty: 0,
        timeLogs: [],
      }));
  }
  return [
    {
      sequence: 10,
      code: 'ASSY',
      name: 'Assembly / finish',
      workCenterCode: 'MAIN',
      status: 'pending',
      plannedSetupMin: 0,
      plannedRunMin: 0,
      actualLaborMin: 0,
      scrapQty: 0,
      reworkQty: 0,
      timeLogs: [],
    },
  ];
}

function ensureTravelerToken(job) {
  if (!job.travelerToken) {
    job.travelerToken = randomUUID();
  }
}

module.exports = { buildOperationsFromBom, ensureTravelerToken };
