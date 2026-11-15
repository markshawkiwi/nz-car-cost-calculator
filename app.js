import { DEFAULTS, calculateVehicle, rankVehicles } from './calculator.js';

const STORAGE_KEY = 'roadwise-calculator-v1';
const GASPY_ENDPOINT = 'https://gaspy-datamine-stats.firebaseio.com/.json';
const GASPY_PRICE_KEYS = new Set(['petrol91', 'petrol95', 'petrol98', 'diesel']);
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

let state = loadState();
let vehicleCatalogue = [];

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
    tripHomeKm: state.tripHomeKm,
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
  const adjustment = vehicle.catalogueId && ['petrol', 'hybrid', 'diesel'].includes(vehicle.type)
    ? input('Real-world adjustment', 'real-world-adjustment', vehicle.realWorldAdjustment ?? 0, '%', -50, 100) : '';
  return `${input('Consumption', 'consumption', vehicle.consumption ?? (vehicle.type === 'ev' ? 16 : 7), unit)}${grade}${adjustment}`;
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
      realWorldAdjustment: 0,
      catalogueId: null,
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
    const adjustment = $('.real-world-adjustment', card);
    if (consumption) change.consumption = Number(consumption.value);
    if (petrol) change.petrolConsumption = Number(petrol.value);
    if (electric) change.electricConsumption = Number(electric.value);
    if (share) change.electricShare = Number(share.value);
    if (grade) change.grade = grade.value;
    if (adjustment) change.realWorldAdjustment = Number(adjustment.value);
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
  const source = vehicle.catalogueId ? ' · NZTA factory figure, editable' : '';
  $('.vehicle-footnote', card).textContent = `${result.detail} · ${typeLabel(vehicle.type)}${source}${result.tripDetail ? ` · Trip: ${result.tripDetail}` : ''}`;
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
  $('#trip-home-km').value = state.tripHomeKm;
  $('#home-share').value = state.homeShare;
  $('#charge-efficiency').value = state.chargeEfficiency;
  $('#standard-ruc').value = state.standardRuc;
  $('#phev-ruc').value = state.phevRuc;
  $$('[data-price]').forEach(inputEl => {
    const value = state.prices[inputEl.dataset.price];
    inputEl.value = GASPY_PRICE_KEYS.has(inputEl.dataset.price) ? Number(value).toFixed(2) : value;
  });
}

function setFuelStatus(label, detail, stateName = '') {
  const status = $('#fuel-status');
  status.textContent = label;
  status.dataset.state = stateName;
  $('#fuel-source-detail').textContent = detail;
}

function setSelectOptions(select, values, label, selected = '') {
  const options = values.map(value => {
    const option = typeof value === 'string' || typeof value === 'number' ? { value, label: value } : value;
    return new Option(String(option.label), String(option.value));
  });
  select.replaceChildren(new Option(label, ''), ...options);
  select.disabled = values.length === 0;
  if (selected && values.some(value => String((value && value.value) ?? value) === String(selected))) select.value = selected;
  if (!select.value && values.length) select.selectedIndex = 1;
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), 'en-NZ', { numeric: true }));
}

function updateCatalogueMakes() {
  const year = Number($('#catalogue-year').value);
  const records = vehicleCatalogue.filter(record => !year || record.year === year);
  setSelectOptions($('#catalogue-make'), unique(records.map(record => record.make)), 'Select make');
  updateCatalogueModels();
}

function updateCatalogueModels() {
  const year = Number($('#catalogue-year').value);
  const make = $('#catalogue-make').value;
  const records = vehicleCatalogue.filter(record => (!year || record.year === year) && (!make || record.make === make));
  setSelectOptions($('#catalogue-model'), unique(records.map(record => record.model)), 'Select model');
  updateCatalogueVariants();
}

function updateCatalogueVariants() {
  const selectedId = $('#catalogue-variant').value;
  const year = Number($('#catalogue-year').value);
  const make = $('#catalogue-make').value;
  const model = $('#catalogue-model').value;
  const records = vehicleCatalogue
    .filter(record => (!year || record.year === year) && (!make || record.make === make) && (!model || record.model === model))
    .sort((a, b) => b.count - a.count || a.variant.localeCompare(b.variant));
  const options = records.map(record => ({
    value: record.id,
    label: `${record.variant} · ${typeLabel(record.type)} · ${record.consumption.toFixed(1)} L/100 km`,
  }));
  setSelectOptions($('#catalogue-variant'), options, 'Select variant', selectedId);
  updateCatalogueStatus();
}

function updateCatalogueStatus() {
  $('#add-catalogue-vehicle').disabled = !$('#catalogue-variant').value;
  const selected = vehicleCatalogue.find(record => record.id === $('#catalogue-variant').value);
  $('#catalogue-status').textContent = selected
    ? `Recorded combined consumption: ${selected.consumption.toFixed(1)} L/100 km · ${selected.count.toLocaleString('en-NZ')} matching NZ vehicles`
    : 'Choose a vehicle to see its recorded combined consumption.';
}

async function loadVehicleCatalogue() {
  try {
    const response = await fetch('./data/vehicles.json');
    if (!response.ok) throw new Error(`Vehicle catalogue returned ${response.status}`);
    const payload = await response.json();
    vehicleCatalogue = payload.records || [];
    const years = unique(vehicleCatalogue.map(record => record.year)).sort((a, b) => b - a);
    setSelectOptions($('#catalogue-year'), years, 'Select year');
    updateCatalogueMakes();
  } catch (error) {
    console.warn('Could not load vehicle catalogue:', error);
    $('#catalogue-status').textContent = 'The NZTA vehicle catalogue is unavailable. Add a custom vehicle instead.';
  }
}

function addCatalogueVehicle() {
  const record = vehicleCatalogue.find(item => item.id === $('#catalogue-variant').value);
  if (!record) return;
  state.vehicles.push({
    id: id(),
    name: `${record.year} ${record.make} ${record.model}`,
    type: record.type,
    consumption: record.consumption,
    grade: 'petrol91',
    catalogueId: record.id,
    realWorldAdjustment: 0,
  });
  saveState();
  renderVehicles();
  $$('.vehicle-card').at(-1)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      petrol91: Math.round(Number(averages?.['91']?.Average)) / 100,
      petrol95: Math.round(Number(averages?.['95']?.Average)) / 100,
      petrol98: Math.round(Number(averages?.['98']?.Average)) / 100,
      diesel: Math.round(Number(averages?.Diesel?.Average)) / 100,
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
    ['#annual-km', 'annualKm'], ['#trip-km', 'tripKm'], ['#trip-home-km', 'tripHomeKm'], ['#home-share', 'homeShare'],
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
  $$('[data-price]').forEach(inputEl => inputEl.addEventListener('change', event => {
    const key = event.target.dataset.price;
    if (!GASPY_PRICE_KEYS.has(key)) return;
    state.prices[key] = Math.round(Number(event.target.value) * 100) / 100;
    event.target.value = state.prices[key].toFixed(2);
    saveState();
    renderVehicles();
  }));
  $('#refresh-gaspy').addEventListener('click', () => fetchGaspyPrices(true));
  $('#catalogue-year').addEventListener('change', updateCatalogueMakes);
  $('#catalogue-make').addEventListener('change', updateCatalogueModels);
  $('#catalogue-model').addEventListener('change', updateCatalogueVariants);
  $('#catalogue-variant').addEventListener('change', updateCatalogueStatus);
  $('#add-catalogue-vehicle').addEventListener('click', addCatalogueVehicle);
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
loadVehicleCatalogue();
