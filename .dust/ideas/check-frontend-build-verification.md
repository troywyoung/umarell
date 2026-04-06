# Check: Frontend Build Verification

Add build verification to dust checks to ensure the frontend app builds successfully.

## Detected Stack

- **Vite 8.x** build tool in `app/` directory
- **React 19** with TypeScript
- **npm build script**: `"build": "tsc -b && vite build"`

## Current Coverage Gap

No build verification exists in `.dust/config/settings.json`. A build check ensures:
- All code compiles and bundles successfully
- Import/export chains are valid
- Asset references are correct
- The production bundle can be created
- Build configuration is valid

Build failures often reveal issues that other checks (lint, types) miss:
- Circular dependencies
- Missing files or assets
- Environment-specific code issues
- Build tool configuration problems

## Suggested Check

```json
{
  "name": "frontend-build",
  "command": "cd app && npm run build"
}
```

## Alternative Options

1. **Build without type checking** (faster if types checked separately)
   ```json
   {
     "name": "frontend-build",
     "command": "cd app && vite build"
   }
   ```

2. **Build with clean output directory**
   ```json
   {
     "name": "frontend-build",
     "command": "cd app && rm -rf dist && npm run build"
   }
   ```

3. **Build with specific mode**
   ```json
   {
     "name": "frontend-build",
     "command": "cd app && npm run build -- --mode production"
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
      "name": "frontend-build",
      "command": "cd app && npm run build"
    }
  ]
}
```

## Trade-offs

**Pros:**
- Catches real-world build failures before deployment
- Validates the complete integration of all frontend pieces
- Essential safety check for production readiness

**Cons:**
- Slower than other checks (builds entire app)
- May duplicate type checking if `frontend-types` check exists
- Creates build artifacts (`dist/` directory)

## Implementation Notes

- The build includes both TypeScript compilation and Vite bundling
- Build artifacts are created in `app/dist/` (should be in `.gitignore`)
- Consider if this check should run on every save or only before commits/pushes
- If using `frontend-types` check separately, consider the faster `vite build` alternative
