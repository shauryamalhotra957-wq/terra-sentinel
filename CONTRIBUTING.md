# Contributing

Install dependencies and run the full quality gate:

~~~bash
npm ci
npm run check
~~~

For UI changes, run the Pages-aware visual QA commands documented in the README. Add focused tests for changes to risk scoring, allocation, warnings, exports, or accessibility.

This repository uses synthetic data and is not certified for emergency dispatch. Preserve clear labels for simulated values and never commit operational data or credentials.
