# Dialog focus harness

Opens each dialog in headless Chromium and checks: focus starts on the dialog, Tab and Shift+Tab stay inside, Escape closes it, focus returns to the opener, stacked dialogs (the Edit menu over the highlight dialog), and the Budget setup footer is visible.

It also checks every control inside the visible data tables (Budget setup with its Create rows open, the Day table under Add purchase, Week with an Actions menu open, Annual with the Misc. Breakdown, the highlight dialog): each is described by its row header (`aria-describedby`) and has a name unique in its table. And it checks the Misc. Breakdown order and its Save for future action, the Actions menu and Update dialog (total, Delete, Move to), alphabetical order, the missing Day view, and at 375px the full-width date navigation and a menu kept inside the window (D006). The import review table is not opened here.

Run:

1. `npm run build`
2. `npm run test:dialogs`

The harness starts `vite preview` on port 4173 itself and stops it at the end. It needs `chrome-headless-shell` in `tools/browsers/` (see the global `lighthouse-sandbox.md`), or set `CHROME_PATH`. It imports `puppeteer-core`, which comes with Lighthouse.
