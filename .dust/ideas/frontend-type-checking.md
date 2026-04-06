# Frontend Type Checking

Add TypeScript type checking for the frontend codebase.

## Context

The project has TypeScript configured for the frontend in `app/` with tsconfig.json, tsconfig.app.json, and tsconfig.node.json. Currently there's no type checking in the checks configuration.

## Detected Stack Indicators

- `app/tsconfig.json` - TypeScript configuration exists
- `app/package.json` has TypeScript in devDependencies (version ~5.9.3)
- Build script uses `tsc -b` which includes type checking

## Suggested Check

Add to `.dust/config/settings.json`:

```json
{
  "name": "typecheck:frontend",
  "command": "cd app && npx tsc -b --noEmit"
}
```

The `--noEmit` flag ensures we only check types without generating output files.

## Alternative Options

- Use the build command which already includes type checking (but slower)
- Add a dedicated npm script in app/package.json

## Benefits

- Catch type errors before runtime
- Ensure type safety across the codebase
- Faster than full build for quick validation
