import { DEFAULTS, calculateVehicle, rankVehicles } from './calculator.js';

const STORAGE_KEY = 'roadwise-calculator-v1';
const GASPY_ENDPOINT = 'https://gaspy-datamine-stats.firebaseio.com/.json';
const GASPY_PRICE_KEYS = new Set(['petrol91', 'petrol95', 'petrol98', 'diesel']);
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

let state = loadState();

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...cloneDefaults(), ...saved, prices: { ...DEFAULTS.prices, ...saved.prices } } : cloneDefaults();
  } catch {
    return cloneDefaults();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function assumptions() {
  return {
    annualKm: state.annualKm,
    tripKm: state.tripKm,
    homeShare: state.homeShare,
    chargeEfficiency: state.chargeEfficiency,
    standardRuc: state.standardRuc,
    phevRuc: state.phevRuc,
    prices: state.prices,
  };
}

function id() {
  return `vehicle-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function typeLabel(type) {
  return { petrol: 'Petrol', diesel: 'Diesel', hybrid: 'Hybrid', phev: 'Plug-in', ev: 'Electric' }[type] || 'Car';
}

function typeIcon(type) {
  return { petrol: 'P', diesel: 'D', hybrid: 'H', phev: 'P+', ev: 'EV' }[type] || 'C';
}

function input(label, className, value, unit, min = 0, max = '') {
  return `<label class="vehicle-field"><span>${label}</span><span class="input-with-unit"><input class="${className}" type="number" min="${min}" ${max !== '' ? `max="${max}"` : ''} step="0.1" value="${value}"><b>${unit}</b></span></label>`;
}

function vehicleInputs(vehicle) {
  if (vehicle.type === 'phev') {
    return `${input('Petrol use', 'petrol-consumption', vehicle.petrolConsumption ?? 5.5, 'L/100 km')}
      ${input('Electricity use', 'electric-consumption', vehicle.electricConsumption ?? 18, 'kWh/100 km')}
      ${input('Driving on electricity', 'electric-share', vehicle.electricShare ?? 70, '%', 0, 100)}
      <label class="vehicle-field"><span>Petrol grade</span><select class="fuel-grade"><option value="petrol91">91</option><option value="petrol95">95</option><option value="petrol98">98</option></select></label>`;
  }
  const unit = vehicle.type === 'ev' ? 'kWh/100 km' : 'L/100 km';
  const grade = (vehicle.type === 'petrol' || vehicle.type === 'hybrid')
    ? `<label class="vehicle-field"><span>Fuel grade</span><select class="fuel-grade"><option value="petrol91">91</option><option value="petrol95">95</option><option value="petrol98">98</option></select></label>` : '';
  return `${input('Consumption', 'consumption', vehicle.consumption ?? (vehicle.type === 'ev' ? 16 : 7), unit)}${grade}`;
}

function renderVehicle(vehicle, index) {
  const fragment = $('#vehicle-template').content.cloneNode(true);
  const card = $('.vehicle-card', fragment);
  card.dataset.id = vehicle.id;
  card.style.setProperty('--delay', `${index * 45}ms`);
  $('.vehicle-icon', card).textContent = typeIcon(vehicle.type);
  $('.vehicle-name', card).value = vehicle.name;
  $('.vehicle-type', card).value = vehicle.type;
  $('.vehicle-inputs', card).innerHTML = vehicleInputs(vehicle);
  const grade = $('.fuel-grade', card);
  if (grade) grade.value = vehicle.grade || 'petrol91';
  bindVehicle(card, vehicle);
  updateVehicleCard(card, vehicle);
  return fragment;
}

function bindVehicle(card, vehicle) {
  $('.vehicle-name', card).addEventListener('input', event => updateVehicle(vehicle.id, { name: event.target.value }));
  $('.vehicle-type', card).addEventListener('change', event => {
    const type = event.target.value;
    updateVehicle(vehicle.id, {
      type,
      consumption: type === 'ev' ? 16 : type === 'diesel' ? 8 : 7,
      petrolConsumption: 5.5,
      electricConsumption: 18,
      electricShare: 70,
    }, true);
  });
  $('.remove-vehicle', card).addEventListener('click', () => {
    if (state.vehicles.length === 1) return;
    state.vehicles = state.vehicles.filter(item => item.id !== vehicle.id);
    saveState();
    renderVehicles();
  });
  $$('.vehicle-inputs input, .vehicle-inputs select', card).forEach(control => control.addEventListener('input', () => {
    const change = {};
    const consumption = $('.consumption', card);
    const petrol = $('.petrol-consumption', card);
    const electric = $('.electric-consumption', card);
    const share = $('.electric-share', card);
    const grade = $('.fuel-grade', card);
    if (consumption) change.consumption = Number(consumption.value);
    if (petrol) change.petrolConsumption = Number(petrol.value);
    if (electric) change.electricConsumption = Number(electric.value);
    if (share) change.electricShare = Number(share.value);
    if (grade) change.grade = grade.value;
    updateVehicle(vehicle.id, change);
  }));
}

function updateVehicle(idValue, change, rerender = false) {
  const vehicle = state.vehicles.find(item => item.id === idValue);
  Object.assign(vehicle, change);
  saveState();
  if (rerender) renderVehicles();
  else {
    const card = $(`.vehicle-card[data-id="${CSS.escape(idValue)}"]`);
    if (card) updateVehicleCard(card, vehicle);
    updateSummary();
  }
}

function updateVehicleCard(card, vehicle) {
  const result = calculateVehicle(vehicle, assumptions());
  $('.vehicle-icon', card).textContent = typeIcon(vehicle.type);
  $('.energy-cost', card).textContent = `${money2.format(result.energyPer100)} /100 km`;
  $('.ruc-cost', card).textContent = `${money2.format(result.rucPer100)} /100 km`;
  $('.per-100', card).textContent = money2.format(result.totalPer100);
  $('.annual-cost', card).textContent = money.format(result.annualCost);
  $('.trip-cost', card).textContent = money2.format(result.tripCost);
  $('.vehicle-footnote', card).textContent = `${result.detail} · ${typeLabel(vehicle.type)}`;
  const denominator = result.totalPer100 || 1;
  $('.energy-bar', card).style.width = `${result.energyPer100 / denominator * 100}%`;
  $('.ruc-bar', card).style.width = `${result.rucPer100 / denominator * 100}%`;
}

function renderVehicles() {
  const grid = $('#vehicle-grid');
  grid.replaceChildren(...state.vehicles.map(renderVehicle));
  updateSummary();
}

function updateSummary() {
  const ranked = rankVehicles(state.vehicles, assumptions());
  const best = ranked[0];
  $('#best-annual').textContent = best ? money.format(best.result.annualCost) : '—';
  $('#best-label').textContent = best ? `${best.vehicle.name || 'Unnamed vehicle'} · ${money2.format(best.result.perKm)}/km` : 'Add a vehicle to compare';
  const summary = $('#results-summary');
  if (!best) return summary.replaceChildren();
  summary.innerHTML = ranked.map((item, index) => {
    const difference = item.result.annualCost - best.result.annualCost;
    return `<div class="rank-item ${index === 0 ? 'best' : ''}"><span>${index + 1}</span><div><b>${escapeHtml(item.vehicle.name || 'Unnamed vehicle')}</b><small>${index === 0 ? 'Lowest estimate' : `${money.format(difference)} more each year`}</small></div><strong>${money.format(item.result.annualCost)}</strong></div>`;
  }).join('');
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function syncInputs() {
  $('#annual-km').value = state.annualKm;
  $('#trip-km').value = state.tripKm;
  $('#home-share').value = state.homeShare;
  $('#charge-efficiency').value = state.chargeEfficiency;
  $('#standard-ruc').value = state.standardRuc;
  $('#phev-ruc').value = state.phevRuc;
  $$('[data-price]').forEach(inputEl => inputEl.value = state.prices[inputEl.dataset.price]);
}

function setFuelStatus(label, detail, stateName = '') {
  const status = $('#fuel-status');
  status.textContent = label;
  status.dataset.state = stateName;
  $('#fuel-source-detail').textContent = detail;
}

async function fetchGaspyPrices(force = false) {
  if (state.fuelSource === 'manual' && !force) {
    setFuelStatus('Manual override', 'Saved manual fuel prices', 'manual');
    return;
  }

  setFuelStatus('Loading Gaspy', 'Connecting to Gaspy…', 'loading');
  $('#refresh-gaspy').disabled = true;
  try {
    const response = await fetch(GASPY_ENDPOINT, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Gaspy returned ${response.status}`);
    const payload = await response.json();
    const averages = payload?.datamine?.Averages;
    const fuelPrices = {
      petrol91: Math.round(Number(averages?.['91']?.Average) * 10) / 1000,
      petrol95: Math.round(Number(averages?.['95']?.Average) * 10) / 1000,
      petrol98: Math.round(Number(averages?.['98']?.Average) * 10) / 1000,
      diesel: Math.round(Number(averages?.Diesel?.Average) * 10) / 1000,
    };
    if (Object.values(fuelPrices).some(value => !Number.isFinite(value) || value <= 0)) {
      throw new Error('Gaspy averages were incomplete');
    }
    Object.assign(state.prices, fuelPrices);
    state.fuelSource = 'gaspy';
    state.gaspyUpdated = payload?.datamine?.Updated || '';
    saveState();
    syncInputs();
    renderVehicles();
    setFuelStatus('Gaspy NZ average', state.gaspyUpdated ? `Gaspy updated ${state.gaspyUpdated}` : 'Latest Gaspy NZ averages', 'gaspy');
  } catch (error) {
    console.warn('Could not update Gaspy prices:', error);
    setFuelStatus('Saved prices', 'Gaspy unavailable — using saved prices', 'error');
  } finally {
    $('#refresh-gaspy').disabled = false;
  }
}

function bindGlobalInputs() {
  const inputs = [
    ['#annual-km', 'annualKm'], ['#trip-km', 'tripKm'], ['#home-share', 'homeShare'],
    ['#charge-efficiency', 'chargeEfficiency'], ['#standard-ruc', 'standardRuc'], ['#phev-ruc', 'phevRuc'],
  ];
  inputs.forEach(([selector, key]) => $(selector).addEventListener('input', event => {
    state[key] = Number(event.target.value);
    saveState();
    renderVehicles();
  }));
  $$('[data-price]').forEach(inputEl => inputEl.addEventListener('input', event => {
    state.prices[event.target.dataset.price] = Number(event.target.value);
    if (GASPY_PRICE_KEYS.has(event.target.dataset.price)) {
      state.fuelSource = 'manual';
      setFuelStatus('Manual override', 'Saved manual fuel prices', 'manual');
    }
    saveState();
    renderVehicles();
  }));
  $('#refresh-gaspy').addEventListener('click', () => fetchGaspyPrices(true));
  $('#add-vehicle').addEventListener('click', () => {
    state.vehicles.push({ id: id(), name: 'My car', type: 'petrol', consumption: 7, grade: 'petrol91' });
    saveState();
    renderVehicles();
    const cards = $$('.vehicle-card');
    cards.at(-1)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('#reset-all').addEventListener('click', () => {
    state = cloneDefaults();
    saveState();
    syncInputs();
    renderVehicles();
    fetchGaspyPrices();
  });
}

syncInputs();
bindGlobalInputs();
renderVehicles();
fetchGaspyPrices();
