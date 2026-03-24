const DEFAULT_ALLOWED_PLANS = ['starter', 'pro', 'enterprise'];

function allowedPlans() {
  const configured = String(process.env.BILLING_ALLOWED_PLANS || '')
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  return configured.length ? [...new Set(configured)] : DEFAULT_ALLOWED_PLANS;
}

function normalizePlan(planRaw, fallback = 'starter') {
  const input = String(planRaw || '').trim().toLowerCase();
  const allowed = allowedPlans();
  if (!input) return { plan: fallback, isKnown: true, input };
  if (allowed.includes(input)) return { plan: input, isKnown: true, input };
  return { plan: fallback, isKnown: false, input };
}

function optionalNormalizedPlan(planRaw) {
  const input = String(planRaw || '').trim().toLowerCase();
  if (!input) return { hasValue: false, plan: '', isKnown: true, input };
  const normalized = normalizePlan(input);
  if (!normalized.isKnown) {
    return { hasValue: true, plan: '', isKnown: false, input: normalized.input };
  }
  return { hasValue: true, plan: normalized.plan, isKnown: true, input: normalized.input };
}

module.exports = {
  DEFAULT_ALLOWED_PLANS,
  allowedPlans,
  normalizePlan,
  optionalNormalizedPlan,
};
