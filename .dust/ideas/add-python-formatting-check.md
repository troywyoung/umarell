# Add Python Formatting Check

Add Ruff formatting check to ensure consistent Python code style across the backend.

## Context

The project has Python backend code in `api/` but no formatting check configured in `.dust/config/settings.json`.

## Stack Indicators

- Python files in `api/` directory
- No `.black`, `.isort`, or formatting configuration files detected

## Recommendation

Use Ruff for formatting. Ruff can replace both Black and isort with a single, fast tool.

## Suggested Configuration

```json
{
  "name": "format-python",
  "command": "cd api && ruff format --check ."
}
```

## Alternative Options

1. **Black** - The popular Python formatter
   ```json
   {
     "name": "format-python",
     "command": "cd api && black --check ."
   }
   ```

2. **Black + isort** - For import sorting too
   ```json
   {
     "name": "format-python",
     "command": "cd api && black --check . && isort --check-only ."
   }
   ```

3. **Ruff check formatting and linting together**
   ```json
   {
     "name": "check-python",
     "command": "cd api && ruff check . && ruff format --check ."
   }
   ```

## Installation Required

If using Ruff (recommended):
```
ruff==0.4.0
```

If using Black:
```
black==24.4.0
```

If using isort:
```
isort==5.13.0
```

## Note

The `--check` flag ensures the command fails if formatting is needed but doesn't modify files.
