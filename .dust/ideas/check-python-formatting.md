# Check: Python Formatting

Add Python code formatting verification to dust checks.

## Detected Stack

- **Python backend** in `api/` directory with ~20 Python files
- No formatting configuration detected (no `.black`, `ruff.toml`, or `pyproject.toml` with formatter config)

## Current Coverage Gap

No formatting checks exist in `.dust/config/settings.json`. Without formatting enforcement:
- Inconsistent code style across files
- Noisy diffs from formatting changes mixed with logic changes
- Review friction from style debates

## Suggested Check

**Recommended: Ruff Format** (fast, zero-config, Black-compatible)

```json
{
  "name": "python-format",
  "command": "cd api && python -m ruff format --check ."
}
```

Ruff needs to be added to `api/requirements.txt`:
```
ruff>=0.1.0
```

The `--check` flag verifies formatting without modifying files.

## Alternative Options

1. **Black** - The original, opinionated formatter
   ```json
   {
     "name": "python-format",
     "command": "cd api && python -m black --check ."
   }
   ```
   Requires: `black>=23.0.0` in requirements.txt

2. **autopep8** - PEP 8 focused
   ```json
   {
     "name": "python-format",
     "command": "cd api && python -m autopep8 --diff --exit-code -r ."
   }
   ```
   Requires: `autopep8>=2.0.0` in requirements.txt

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
      "name": "python-format",
      "command": "cd api && python -m ruff format --check ."
    }
  ]
}
```

## Implementation Notes

- Ruff Format is recommended because it's extremely fast and compatible with Black's output
- If using Ruff for linting (see `check-python-linting.md`), using Ruff Format reduces tool count
- Initial run will likely require formatting the entire codebase first: `cd api && python -m ruff format .`
