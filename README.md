# NZ Car Cost Calculator

A planned mobile-friendly running-cost calculator for personal use and sharing with friends in New Zealand.

## Project status

The web interface supports editable vehicle comparisons, make/model selection from NZTA open data, local saving, a transparent cost breakdown and automatic NZ-average fuel prices from Gaspy.

## First version

- Compare named petrol, diesel, petrol hybrid, plug-in hybrid and electric vehicles.
- Enter consumption, annual distance and an optional trip distance.
- Compare cents per kilometre, dollars per 100 kilometres, annual cost and trip cost.
- Show energy and road user charges separately.
- Preserve the original spreadsheet's home/public charging split and charging efficiency inputs.
- Allow manual prices and consumption overrides.
- Save comparisons on each person's device.
- Choose common NZ-registered petrol, diesel and hybrid vehicles by year, make, model and variant.
- Apply a per-vehicle real-world percentage adjustment to an NZTA factory consumption figure.

## Vehicle catalogue

`data/vehicles.json` contains a compact catalogue generated from the [NZTA Motor Vehicle Register open data](https://www.nzta.govt.nz/resources/new-zealand-motor-vehicle-register-statistics/new-zealand-vehicle-fleet-open-data-sets/). It includes the 240 most common recorded passenger-vehicle variants for each model year from 2000 onward and uses the recorded `FC_COMBINED` value as an editable starting point. Catalogue vehicles also have an optional percentage adjustment that is applied to the recorded consumption before costs are calculated.

Run `python3 scripts/build_vehicle_catalog.py` to refresh it. The `Update NZTA vehicle catalogue` GitHub Action runs monthly and commits any changed catalogue. EVs and plug-in hybrids remain custom entries because this source does not provide the separate energy inputs needed by the calculator for those powertrains.

## Run locally

Use a local static server from this folder, or run `npm run build` and serve the generated `dist` directory. The calculation checks run with `npm test`.

## Fuel prices

Fuel prices come from the public dataset used by [Gaspy's NZ statistics](https://www.gaspy.nz/stats.html). The calculator loads national averages for 91, 95, 98 and diesel, displays Gaspy's update time and retains the last saved prices if an update fails.

Editing a fuel price activates a saved manual override. `Refresh from Gaspy` replaces the four pump prices with current national averages. Electricity rates remain separately editable.

## Calculation requirements

- Fuel cost per 100 km = litres per 100 km × dollars per litre.
- EV energy cost per 100 km = battery consumption per 100 km ÷ charging efficiency × weighted electricity rate. Do not add charging losses again when the supplied consumption already includes them.
- RUC cost per km = applicable RUC price per 1,000 km ÷ 1,000. Model purchase transaction fees separately.
- Plug-in hybrids need separate petrol and electricity assumptions and an explicit electric-driving share; avoid applying blended consumption to the same share twice.
- Keep RUC defaults editable and record their source and effective date.

The original workbook is the reference for the existing calculations. Its stored fuel prices and RUC figures are historical inputs, not live defaults.

## Later ideas

EV presets from a suitable kWh/100 km source, shareable comparison links, and an optional ownership-cost view covering servicing, tyres, insurance, depreciation and purchase-price differences.

## Repository and hosting

Public repository: [markshawkiwi/nz-car-cost-calculator](https://github.com/markshawkiwi/nz-car-cost-calculator).

Live website: [markshawkiwi.github.io/nz-car-cost-calculator](https://markshawkiwi.github.io/nz-car-cost-calculator/). GitHub Pages publishes the root of the `main` branch and updates after new commits.
