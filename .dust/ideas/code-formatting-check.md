# Code Formatting Check

Add formatting checks for both frontend and backend code.

## Context

Neither the Python backend nor the TypeScript frontend have formatting checks configured. Automated formatting ensures consistent code style across the codebase.

## Detected Stack Indicators

- TypeScript/React frontend in `app/`
- Python backend in `api/`
- No Prettier configuration found
- No Black/Ruff format configuration found

## Suggested Checks

### Frontend Formatting (Prettier)

Add to `.dust/config/settings.json`:

```json
{
  "name": "format:check:frontend",
  "command": "cd app && npx prettier --check 'src/**/*.{ts,tsx,css}'"
}
```

Requires adding Prettier to app/package.json devDependencies.

### Backend Formatting (Ruff or Black)

**Option 1: Ruff format** (faster, all-in-one with linting)

```json
{
  "name": "format:check:backend",
  "command": "cd api && python -m ruff format --check ."
}
```

**Option 2: Black** (popular Python formatter)

```json
{
  "name": "format:check:backend",
  "command": "cd api && python -m black --check ."
}
```

## Alternative Options

- Auto-fix instead of check (use git hooks for pre-commit formatting)
- Skip formatting checks if linting is sufficient
- Combine frontend and backend in single check

## Recommendation

- Frontend: Add Prettier
- Backend: Use Ruff format (combines with linting recommendation)

## Benefits

- Zero debates about code style
- Consistent formatting across all files
- Automatic code cleanup
- Better diffs in version control
