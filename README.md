# Simple_Budget

So simple my partner will use it.

## Description
**Human managed; AI coded app**
A local-first budgeting app for tracking expenses, categories, and budgets with simple setup and editing.

Also, a test on Kilo of how good llama3 and Qwen3.x are at coding. I am acting as Designer and QA.

As of 10/26/26, I think it sucks, but this is why we test.

## Tech Stack

- React + TypeScript
- Vite
- PWA (vite-plugin-pwa)

## Features

- Budget setup and editing
- Category/item selection
- Frequency-based budgeting (day/week/month)
- Local persistence

## Setup

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Folder Structure

```
src/
  screens/       # app screens
  components/ui/ # reusable UI components
  storage/       # data layer
public/          # static assets
```

## Versioning

Version format: `v{major}.{subversion}.{item}` (e.g. `v0.2.6`). See `docs/design/0003-roadmap.md`.
