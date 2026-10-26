# Initial Requirements

Design doc: initial requirements for the Simple Budget app. To be fleshed out in subsequent chat sessions.

## Overview

- **Goal**: A budget app simple enough for a non-technical partner to want to use.
- **UX bar**: Extremely user-friendly.
- **Reward**: A cute animation/reward every time the user enters a budget item. Must be toggleable off (user dislikes it).
- **Platforms**: GrapheneOS, Android, Web — single codebase.
- **Distribution**: PWA for v1 (no cert); per-OS install instructions in docs. APK/Capacitor deferred (needed later for reliable local notifications).
- **Sync**: Multi-device sync on launch via shared account (vendor-agnostic adapter). Storage shape: one JSON doc per dataset with per-record `updatedAt`; sync = pull-then-push, last-write-wins; soft-delete tombstones; optional passphrase client-side encryption. OnlyOffice for testing + seed data. Dropped device-stored sync-on-open.
- **UI**: Built in-house (no component kit) for full accessibility control.

## Screen 1: Update Budget

Toggles: Add / Edit / Delete; Income / Savings / Expense.

### Add
- Dropdown with search: search known budget items or filter by category.
- Date picker (optional; defaults to current day).
- Amount (required).
- Save button.
- Animation on save.

### Edit
- Dropdown with search: search known budget items or filter by category.
- Date picker (optional).
- Amount (optional).
- List matching items as a checkbox group (at least one required).
- Selected items get a "New value" input (all required).
- Save button.
- Animation on save.

### Delete
- Dropdown with search: search known budget items or filter by category.
- Date picker (optional).
- Amount (optional).
- List matching items as a checkbox group (at least one required).
- Save button.
- Animation on save.

## Categories

CRUD for categories (create, rename, delete, list). Categories back the filter in the Update Budget dropdowns.

## Notifications

Up to one notification per day: "Did you add all your purchases?" Toggleable.

## Screen 2: Budget

Toggles: Day / Week / Month / Year / Historic.

Switch: Table / Chart.

## Open Questions

- TBD: specific reward animation style (held).
- TBD: category list and known budget items seed data (sourced from OnlyOffice sheet).
- TBD: chart types for the Budget screen.
- TBD: sync conflict resolution (timestamps / last-write-wins).
- TBD: sync adapter auth flow + data format (JSON/CSV) + encryption approach.
- TBD: receipt photo capture feasibility (post-v1).
