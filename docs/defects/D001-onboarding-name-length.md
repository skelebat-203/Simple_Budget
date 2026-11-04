# D001 — Onboarding "add your own" accepts more than 60 characters without saying so

- Found: 2026-11-04, v0.5 security review (3.3).
- Severity: Low (data is cut to the limit, not corrupted).
- What happens: the multi-select text box has no length limit. Typing 200 characters and adding keeps only the first 60 (`cleanName`), with no message.
- Fix: stop typing at 60 characters (`maxLength` from `NAME_MAX` on the multi-select input) and say the limit in the field help, as Budget setup's Create field does.
- Files: `src/components/ui/MultiSelect.tsx`, `src/screens/Onboarding.tsx`.
- Scheduled: v0.6.
