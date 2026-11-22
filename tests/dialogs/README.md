# Dialog focus harness

Opens each dialog in headless Chromium and checks: focus starts on the dialog, Tab and Shift+Tab stay inside, Escape closes it, focus returns to the opener, stacked dialogs (the Edit menu over the highlight dialog), and the Budget setup footer is visible.

Run:

1. `npm run build`
2. `npm run test:dialogs`

The harness starts `vite preview` on port 4173 itself and stops it at the end. It needs `chrome-headless-shell` in `tools/browsers/` (see the global `lighthouse-sandbox.md`), or set `CHROME_PATH`. It imports `puppeteer-core`, which comes with Lighthouse.
