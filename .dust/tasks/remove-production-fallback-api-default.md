# Remove production fallback API default

Stop the frontend from silently falling back to the production API when VITE_API_URL is unset. Local and staging mistakes should fail obviously instead of routing traffic to production.

## Task Type

implement

## Blocked By

(none)


## Definition of Done

- Replace the production fallback in app/src/config.ts with a non-production-safe default or explicit failure path.
- Align the main app and admin panel API base configuration so they do not point at different backends by default.
- Document the expected local API environment value in the code comments or config usage near the frontend API base.
