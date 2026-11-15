import assert from 'node:assert/strict';
import { calculateVehicle, blendedElectricityPrice, rankVehicles } from '../calculator.js';

const assumptions = {
  annualKm: 10000,
  tripKm: 220,
  tripHomeKm: 350,
  homeShare: 80,
  chargeEfficiency: 95,
  standardRuc: 76,
  phevRuc: 38,
  prices: { petrol91: 3.3, petrol95: 3.5, petrol98: 3.6, diesel: 3.8, homeElectric: 0.2, publicElectric: 0.82 },
};

assert.ok(Math.abs(blendedElectricityPrice(assumptions.prices, 80) - 0.324) < 1e-9);

const diesel = calculateVehicle({ type: 'diesel', consumption: 8 }, assumptions);
assert.equal(diesel.energyPer100, 30.4);
assert.equal(diesel.rucPer100, 7.6);
assert.equal(diesel.annualCost, 3800);

const petrol = calculateVehicle({ type: 'petrol', consumption: 8, grade: 'petrol91' }, assumptions);
assert.equal(petrol.totalPer100, 26.4);
assert.equal(petrol.tripCost, 58.08);

const adjustedPetrol = calculateVehicle({ type: 'petrol', consumption: 8, realWorldAdjustment: 15, grade: 'petrol91' }, assumptions);
assert.ok(Math.abs(adjustedPetrol.adjustedConsumption - 9.2) < 1e-9);
assert.ok(Math.abs(adjustedPetrol.totalPer100 - 30.36) < 1e-9);
assert.match(adjustedPetrol.detail, /\+15% real-world adjustment/);

const ev = calculateVehicle({ type: 'ev', consumption: 15 }, assumptions);
assert.ok(Math.abs(ev.energyPer100 - 5.115789473684211) < 1e-9);
assert.ok(Math.abs(ev.annualCost - 1271.578947368421) < 1e-9);
assert.ok(Math.abs(ev.tripCost - 23.66736842105263) < 1e-9);
assert.equal(ev.tripDetail, '220 km at home rate');

const longEvTrip = calculateVehicle({ type: 'ev', consumption: 15 }, { ...assumptions, tripKm: 500 });
assert.ok(Math.abs(longEvTrip.tripCost - 68.47368421052632) < 1e-9);
assert.equal(longEvTrip.tripDetail, '350 km home + 150 km public');

const phev = calculateVehicle({ type: 'phev', petrolConsumption: 5, electricConsumption: 18, electricShare: 70, grade: 'petrol91' }, assumptions);
assert.ok(phev.energyPer100 > 0);
assert.equal(phev.rucPer100, 3.8);

const ranked = rankVehicles([{ name: 'Diesel', type: 'diesel', consumption: 8 }, { name: 'EV', type: 'ev', consumption: 15 }], assumptions);
assert.equal(ranked[0].vehicle.name, 'EV');

console.log('Calculator tests passed');
