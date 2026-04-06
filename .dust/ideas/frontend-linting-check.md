# Frontend Linting Check

Add ESLint check for the React/TypeScript frontend.

## Context

The project has a React/TypeScript frontend in the `app/` directory with ESLint already configured (eslint.config.js exists with TypeScript ESLint, React Hooks, and React Refresh plugins).

Currently `.dust/config/settings.json` only has a placeholder test command. The frontend should have a linting check.

## Detected Stack Indicators

- `app/eslint.config.js` - ESLint configuration exists
- `app/package.json` has `"lint": "eslint ."` script
- TypeScript ESLint parser and React plugins configured

## Suggested Check

Add to `.dust/config/settings.json`:

```json
{
  "name": "lint:frontend",
  "command": "cd app && npm run lint"
}
```

## Alternative Options

- Run both frontend and backend checks in parallel (would require multiple check entries)
- Create a root-level npm script that runs all checks

## Benefits

- Catch code quality issues early in the development process
- Enforce consistent coding style
- Prevent common React and TypeScript errors before they reach production
