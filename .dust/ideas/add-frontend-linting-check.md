# Add Frontend Linting Check

Add ESLint check for the TypeScript/React frontend to maintain code quality standards.

## Context

The project has a TypeScript/React frontend in `app/` with ESLint configured but no linting check in `.dust/config/settings.json`.

## Stack Indicators

- `app/eslint.config.js` present with TypeScript and React configurations
- ESLint configured in `app/package.json` with script `"lint": "eslint ."`
- ESLint plugins for React hooks and React refresh configured

## Recommendation

Add ESLint check using the existing npm script.

## Suggested Configuration

```json
{
  "name": "lint-frontend",
  "command": "cd app && npm run lint"
}
```

## Alternative Options

1. **Direct ESLint command**
   ```json
   {
     "name": "lint-frontend",
     "command": "cd app && npx eslint ."
   }
   ```

2. **ESLint with max warnings**
   ```json
   {
     "name": "lint-frontend",
     "command": "cd app && npx eslint . --max-warnings 0"
   }
   ```

## Notes

- ESLint is already configured with TypeScript, React Hooks, and React Refresh plugins
- The existing `lint` script in `package.json` can be used directly
- No additional installation required - all dependencies already present
