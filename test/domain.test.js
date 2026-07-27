const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateCommission, validateCommissionDistribution } = require('../utils/domain');

test('calcula comisión en pesos sobre un pago parcial', () => {
  assert.equal(calculateCommission(4_000_000, 10), 400_000);
});

test('distribuye comisión entre dos aliados sin superar el límite', () => {
  const result = validateCommissionDistribution([8, 2], 10);
  assert.deepEqual(result, { total: 10, valid: true });
});

test('rechaza una distribución superior al límite del caso', () => {
  assert.equal(validateCommissionDistribution([8, 3], 10).valid, false);
});

test('rechaza porcentajes negativos o superiores al 100 %', () => {
  assert.throws(() => calculateCommission(1_000_000, -1), /invalid_percentage/);
  assert.throws(() => calculateCommission(1_000_000, 101), /invalid_percentage/);
});

test('rechaza bases iguales o inferiores a cero', () => {
  assert.throws(() => calculateCommission(0, 10), /invalid_base_amount/);
});
