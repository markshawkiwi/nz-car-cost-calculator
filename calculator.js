export const DEFAULTS = {
  annualKm: 15000,
  tripKm: 220,
  homeShare: 80,
  chargeEfficiency: 95,
  standardRuc: 76,
  phevRuc: 38,
  prices: { petrol91: 2.8, petrol95: 3.0, petrol98: 3.1, diesel: 2.0, homeElectric: 0.3, publicElectric: 0.82 },
  vehicles: [
    { id: 'petrol-example', name: 'Petrol hatch', type: 'petrol', consumption: 7.2, grade: 'petrol91' },
    { id: 'diesel-example', name: 'Diesel SUV', type: 'diesel', consumption: 8.0 },
    { id: 'hybrid-example', name: 'Petrol hybrid', type: 'hybrid', consumption: 4.5, grade: 'petrol91' },
    { id: 'ev-example', name: 'Electric car', type: 'ev', consumption: 15.0 },
  ],
};

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : fallback;

export function blendedElectricityPrice(prices, homeShare) {
  const share = Math.min(100, finite(homeShare)) / 100;
  return finite(prices.homeElectric) * share + finite(prices.publicElectric) * (1 - share);
}

export function calculateVehicle(vehicle, assumptions) {
  const consumption = finite(vehicle.consumption);
  const annualKm = finite(assumptions.annualKm);
  const tripKm = finite(assumptions.tripKm);
  const efficiency = Math.max(0.01, Math.min(100, finite(assumptions.chargeEfficiency, 95)) / 100);
  const electricPrice = blendedElectricityPrice(assumptions.prices, assumptions.homeShare);
  let energyPer100 = 0;
  let rucPer100 = 0;
  let detail = '';

  if (vehicle.type === 'petrol' || vehicle.type === 'hybrid') {
    const grade = vehicle.grade || 'petrol91';
    energyPer100 = consumption * finite(assumptions.prices[grade]);
    detail = `${consumption.toFixed(1)} L/100 km`;
  } else if (vehicle.type === 'diesel') {
    energyPer100 = consumption * finite(assumptions.prices.diesel);
    rucPer100 = finite(assumptions.standardRuc) / 10;
    detail = `${consumption.toFixed(1)} L/100 km`;
  } else if (vehicle.type === 'ev') {
    energyPer100 = consumption * electricPrice / efficiency;
    rucPer100 = finite(assumptions.standardRuc) / 10;
    detail = `${consumption.toFixed(1)} kWh/100 km`;
  } else if (vehicle.type === 'phev') {
    const electricShare = Math.min(100, finite(vehicle.electricShare, 70)) / 100;
    const petrol = finite(vehicle.petrolConsumption, consumption || 5.5) * finite(assumptions.prices[vehicle.grade || 'petrol91']);
    const electric = finite(vehicle.electricConsumption, 18) * electricPrice / efficiency;
    energyPer100 = petrol * (1 - electricShare) + electric * electricShare;
    rucPer100 = finite(assumptions.phevRuc) / 10;
    detail = `${Math.round(electricShare * 100)}% electric driving`;
  }

  const totalPer100 = energyPer100 + rucPer100;
  return {
    energyPer100,
    rucPer100,
    totalPer100,
    perKm: totalPer100 / 100,
    annualCost: totalPer100 * annualKm / 100,
    tripCost: totalPer100 * tripKm / 100,
    detail,
  };
}

export function rankVehicles(vehicles, assumptions) {
  return vehicles.map(vehicle => ({ vehicle, result: calculateVehicle(vehicle, assumptions) }))
    .sort((a, b) => a.result.annualCost - b.result.annualCost);
}
