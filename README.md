# NZ Car Cost Calculator

A planned mobile-friendly running-cost calculator for personal use and sharing with friends in New Zealand.

## Project status

The first web interface is built. It supports editable vehicle comparisons, local saving, a transparent cost breakdown and automatic NZ-average fuel prices from Gaspy.

## First version

- Compare named petrol, diesel, petrol hybrid, plug-in hybrid and electric vehicles.
- Enter consumption, annual distance and an optional trip distance.
- Compare cents per kilometre, dollars per 100 kilometres, annual cost and trip cost.
- Show energy and road user charges separately.
- Preserve the original spreadsheet's home/public charging split and charging efficiency inputs.
- Allow manual prices and consumption overrides.
- Save comparisons on each person's device.

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

Verified vehicle presets, shareable comparison links, and an optional ownership-cost view covering servicing, tyres, insurance, depreciation and purchase-price differences.

## Repository and hosting

Private repository: [markshawkiwi/nz-car-cost-calculator](https://github.com/markshawkiwi/nz-car-cost-calculator). Website hosting and public access will be configured separately. Friends should be able to use the eventual calculator without GitHub accounts.
