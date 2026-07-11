# Legacy workout frontend

React + Vite dashboard from the original fitness-tracking app. Tables: `workout_*`.

**Vanguard OS** (daily loop, stream, oracle, planning) lives in **Telegram + Supabase edge functions** — not here. See `AGENTS.md` and `docs/ARCHITECTURE.md`.

Still used for: dashboard widgets, biometric sync UI, workout logging. Oracle chat lives in Telegram — the web `MentorChat.jsx` was removed 2026-06-11 along with 9 other unmounted components (see git history).
