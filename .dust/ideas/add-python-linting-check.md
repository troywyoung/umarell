# Add Python Linting Check

Configure Ruff linting for the Python backend to catch code quality issues before they reach production.

## Context

The project has Python backend code in `api/` but no linting check configured in `.dust/config/settings.json`.

## Stack Indicators

- Python files in `api/` directory
- `api/requirements.txt` with FastAPI and other Python dependencies
- No existing Python linting configuration files detected

## Recommendation

Add Ruff as the linting tool. Ruff is a modern, fast Python linter that combines the functionality of flake8, pylint, and more.

## Suggested Configuration

```json
{
  "name": "lint-python",
  "command": "cd api && ruff check ."
}
```

## Alternative Options

1. **Flake8** - Traditional Python linter
   ```json
   {
     "name": "lint-python",
     "command": "cd api && flake8 ."
   }
   ```

2. **Pylint** - Comprehensive but slower linter
   ```json
   {
     "name": "lint-python",
     "command": "cd api && pylint **/*.py"
   }
   ```

## Installation Required

Add to `api/requirements.txt`:
```
ruff==0.4.0
```

Or for development dependencies, create `api/requirements-dev.txt`.
