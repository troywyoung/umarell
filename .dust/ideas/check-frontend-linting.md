# Check: Frontend Linting

Add ESLint execution to dust checks for the React/TypeScript frontend.

## Detected Stack

- **React 19** with TypeScript in `app/` directory
- **ESLint** already configured with modern flat config (`eslint.config.js`)
- **TypeScript ESLint** plugin installed
- **React Hooks** and **React Refresh** plugins configured
- **npm script** available: `"lint": "eslint ."`

## Current Coverage Gap

The `.dust/config/settings.json` only has a root-level `npm test` placeholder. Frontend linting is not being run as part of dust checks, even though:
- ESLint is fully configured in `app/eslint.config.js`
- The npm script exists: `npm run lint` in `app/package.json`
- Modern TypeScript-aware rules are ready to use

## Suggested Check

```json
{
  "name": "frontend-lint",
  "command": "cd app && npm run lint"
}
```

## Alternative Options

- `cd app && npx eslint .` - Direct ESLint invocation (bypasses npm)
- `cd app && npm run lint -- --max-warnings=0` - Fail on warnings too
- `cd app && npm run lint -- --quiet` - Only show errors, suppress warnings

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
      "name": "frontend-lint",
      "command": "cd app && npm run lint"
    }
  ]
}
```

## Implementation Notes

- ESLint is already configured with strong rules (recommended configs from React, TypeScript)
- Uses modern flat config format (ESLint 9.x)
- Includes React Hooks rules to catch common React mistakes
- No additional setup needed - ready to use immediately
