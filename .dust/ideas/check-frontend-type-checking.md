# Check: Frontend Type Checking

Add TypeScript type checking to dust checks for the React frontend.

## Detected Stack

- **TypeScript ~5.9.3** configured in `app/` directory
- **React** with full TypeScript support
- **tsconfig.json** with project references structure
- **npm build script** includes TypeScript compilation: `"build": "tsc -b && vite build"`

## Current Coverage Gap

No standalone TypeScript check exists in `.dust/config/settings.json`. While the build includes type checking, having a dedicated type check:
- Runs faster (no Vite build overhead)
- Provides clearer output focused on type errors
- Catches type issues before build stage
- Aligns with typical frontend development workflows

## Suggested Check

```json
{
  "name": "frontend-types",
  "command": "cd app && npx tsc -b --noEmit"
}
```

The `--noEmit` flag runs type checking without generating JavaScript output, making it faster.

## Alternative Options

1. **Type check with verbose output**
   ```json
   {
     "name": "frontend-types",
     "command": "cd app && npx tsc -b --noEmit --pretty"
   }
   ```

2. **Type check specific projects**
   ```json
   {
     "name": "frontend-types",
     "command": "cd app && npx tsc --project tsconfig.app.json --noEmit"
   }
   ```

3. **Include declaration generation**
   ```json
   {
     "name": "frontend-types",
     "command": "cd app && npx tsc -b"
   }
   ```

## Configuration Snippet

Add to `.dust/config/settings.json`:

```json
{
  "dustCommand": "npx dust",
  "checks": [
    {
      "name": "test",
      "command": "npm test"
    },
    {
      "name": "frontend-types",
      "command": "cd app && npx tsc -b --noEmit"
    }
  ]
}
```

## Implementation Notes

- TypeScript is already fully configured with project references
- The `-b` (build mode) flag respects project references in `tsconfig.json`
- `--noEmit` ensures this is purely a check, not a build step
- Type checking is separate from build, allowing faster feedback during development
