# Add Frontend Build Verification

Add Vite build check to ensure the TypeScript/React frontend compiles successfully.

## Context

The project has a TypeScript/React frontend in `app/` built with Vite but no build verification check in `.dust/config/settings.json`.

## Stack Indicators

- `app/vite.config.ts` present
- Vite configured in `app/package.json` with build script `"build": "tsc -b && vite build"`
- TypeScript compilation included in build process

## Recommendation

Add Vite build check to ensure the frontend builds successfully.

## Suggested Configuration

```json
{
  "name": "build-frontend",
  "command": "cd app && npm run build"
}
```

## Alternative Options

1. **Build to a temporary directory** (avoid polluting dist/)
   ```json
   {
     "name": "build-frontend",
     "command": "cd app && npx vite build --outDir dist-check && rm -rf dist-check"
   }
   ```

2. **Type check only** (faster, no build artifacts)
   ```json
   {
     "name": "build-frontend",
     "command": "cd app && npx tsc -b"
   }
   ```

## Notes

- The build command runs `tsc -b` first (type checking) then `vite build`
- Build artifacts are created in `app/dist/` directory
- This check verifies both type correctness and successful bundling
- Consider adding `app/dist/` to `.gitignore` if not already present
