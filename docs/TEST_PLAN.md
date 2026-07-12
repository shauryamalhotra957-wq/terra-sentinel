# Test Plan

## Automated Gates

```bash
npm run lint
npm run test
npm run build
npm run security:audit
```

For deployment smoke testing:

```bash
npm run build:pages
npm run preview:pages
npm run qa:visual
```

## Covered Behavior

- Risk rises when flood stress increases.
- Lifeline projections stay inside 0-100 bounds.
- Allocation never uses more units than available inventory.
- Coverage and equity calculations produce actionable values.
- Forecast returns one point for every requested hour.
- Warning messages are sanitized and checksum-stamped.
- CSV/JSON exports include expected fields.
- The rendered dashboard supports scenario switching, slider changes, export actions, and an accessibility smoke test.

## Manual QA Checklist

- Open the app on desktop and mobile widths.
- Switch all scenario presets.
- Move every slider and confirm metrics update.
- Select several districts on the map.
- Export packet JSON, district CSV, and allocation CSV.
- Copy public warning messages.
- Run a production preview from `dist`.
- Run the Pages visual QA against `/terra-sentinel/` on desktop and mobile viewports.

## Latest Local Verification

Completed on 2026-07-12:

- `npm run lint` passed.
- `npm run test` passed: 3 files, 11 tests.
- `npm run build` passed: production JS 227.43 kB minified, 72.67 kB gzip.
- `npm run security:audit` passed with 0 vulnerabilities.

