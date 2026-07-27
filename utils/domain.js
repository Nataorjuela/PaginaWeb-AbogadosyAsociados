function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function calculateCommission(baseAmount, percentage) {
  const base = Number(baseAmount);
  const rate = Number(percentage);
  if (!Number.isFinite(base) || base <= 0) throw new Error('invalid_base_amount');
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('invalid_percentage');
  return roundMoney(base * rate / 100);
}

function validateCommissionDistribution(percentages, maximumPercentage = 100) {
  const maximum = Number(maximumPercentage);
  if (!Number.isFinite(maximum) || maximum < 0 || maximum > 100) throw new Error('invalid_maximum_percentage');
  const total = percentages.reduce((sum, value) => {
    const percentage = Number(value);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) throw new Error('invalid_percentage');
    return sum + percentage;
  }, 0);
  return { total: roundMoney(total), valid: total <= maximum };
}

module.exports = {
  calculateCommission,
  roundMoney,
  validateCommissionDistribution
};
