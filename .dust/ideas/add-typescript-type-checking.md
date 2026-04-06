# Add TypeScript Type Checking

Configure TypeScript type checking to catch type errors in the frontend before runtime.

## Context

The project has a TypeScript/React frontend in `app/` but no TypeScript type checking configured in `.dust/config/settings.json`.

## Stack Indicators

- `app/tsconfig.json`, `app/tsconfig.app.json`, and `app/tsconfig.node.json` present
- TypeScript configured in `app/package.json` with version ~5.9.3
- `app/package.json` build script includes `tsc -b`

## Recommendation

Add TypeScript type checking using `tsc` to catch type errors.

## Suggested Configuration

```json
{
  "name": "typecheck-typescript",
  "command": "cd app && npx tsc --noEmit"
}
```

## Alternative Options

1. **Use the build command** (type checks + builds)
   ```json
   {
     "name": "typecheck-typescript",
     "command": "cd app && npm run build"
   }
   ```

2. **Type check with strict mode**
   ```json
   {
     "name": "typecheck-typescript",
     "command": "cd app && npx tsc --noEmit --strict"
   }
   ```

## Notes

- `--noEmit` flag ensures tsc only checks types without generating output files
- The `tsc` command uses the project's `tsconfig.json` configuration
- TypeScript is already installed as a dev dependency, so no additional installation needed
