# Check: Python Linting

Add Python linting to dust checks for code quality enforcement.

## Detected Stack

- **Python 3.x** backend in `api/` directory
- **FastAPI** framework with multiple modules
- No existing linting configuration detected (no `.flake8`, `ruff.toml`, or `pyproject.toml`)

## Current Coverage Gap

No Python linting is configured in `.dust/config/settings.json`. This means:
- Code style inconsistencies can slip through
- Common bugs (unused imports, undefined names) aren't caught
- No enforcement of Python best practices

## Suggested Check

**Recommended: Ruff** (modern, fast, all-in-one linter)

```json
{
  "name": "python-lint",
  "command": "cd api && python -m ruff check ."
}
```

Ruff needs to be added to `api/requirements.txt`:
```
ruff>=0.1.0
```

## Alternative Options

1. **flake8** - Traditional, well-established
   ```json
   {
     "name": "python-lint",
     "command": "cd api && python -m flake8 ."
   }
   ```
   Requires: `flake8>=6.0.0` in requirements.txt

2. **pylint** - More comprehensive, slower
   ```json
   {
     "name": "python-lint",
     "command": "cd api && python -m pylint **/*.py"
   }
   ```
   Requires: `pylint>=3.0.0` in requirements.txt

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
      "name": "python-lint",
      "command": "cd api && python -m ruff check ."
    }
  ]
}
```

## Implementation Notes

- Ruff is recommended because it's fast, comprehensive, and actively maintained
- Initial run may require adding a `ruff.toml` or `pyproject.toml` config to suppress false positives
- Consider starting with basic rules and gradually enabling more strict checks
