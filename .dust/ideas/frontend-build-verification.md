# Frontend Build Verification

Add Vite build verification to ensure the frontend compiles successfully.

## Context

The project uses Vite for building the React frontend. Ensuring the frontend builds successfully is an important check to catch issues early.

## Detected Stack Indicators

- `app/vite.config.ts` - Vite configuration exists
- `app/package.json` has `"build": "tsc -b && vite build"` script
- Vite 8.0.1 installed in devDependencies

## Suggested Check

Add to `.dust/config/settings.json`:

```json
{
  "name": "build:frontend",
  "command": "cd app && npm run build"
}
```

## Alternative Options

- Skip this if type checking and linting are sufficient
- Only run on CI, not locally (slower check)

## Considerations

- Build checks can be slower (typically 10-30s)
- May want to run this less frequently than lint/typecheck
- Already includes type checking (tsc -b), so may be redundant with separate typecheck

## Benefits

- Ensures production bundle can be created
- Catches build-time issues that might not appear in dev mode
- Validates Vite configuration and dependencies
