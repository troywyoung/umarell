# Fix instance-aware app API calls

Update the remaining frontend observation requests to use instance-prefixed API URLs. The main feed already uses instance routing, but follow-up actions in App.tsx still call unprefixed observation endpoints and break after the multi-instance backend change.

## Task Type

implement

## Blocked By

(none)


## Definition of Done

- Find every observation-related fetch in app/src/App.tsx that still uses direct API paths.
- Update those requests to build URLs with the active instance key and the shared API URL helper.
- Keep auth headers and request methods consistent with the existing hook-based observation calls.
- Confirm the main observation flow and follow-up actions all target the same instance-aware backend paths.
