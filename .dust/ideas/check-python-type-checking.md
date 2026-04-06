# Check: Python Type Checking

Add static type checking to dust checks for the Python backend.

## Detected Stack

- **Python 3.x** with FastAPI (which has excellent type hint support)
- **Pydantic** in requirements (2.9.0) - relies heavily on type hints
- No type checking configuration detected (no `mypy.ini` or `pyproject.toml` with mypy config)

## Current Coverage Gap

No type checking exists in `.dust/config/settings.json`. FastAPI and Pydantic work best with type hints, but without verification:
- Type hints can become stale/incorrect
- Runtime type errors aren't caught early
- IDE assistance is limited
- API contract violations aren't detected

## Suggested Check

**Recommended: mypy** (de facto standard for Python type checking)

```json
{
  "name": "python-types",
  "command": "cd api && python -m mypy ."
}
```

Mypy needs to be added to `api/requirements.txt`:
```
mypy>=1.0.0
```

## Alternative Options

1. **pyright** - Microsoft's type checker, faster
   ```json
   {
     "name": "python-types",
     "command": "cd api && python -m pyright ."
   }
   ```
   Requires: `pyright>=1.1.0` in requirements.txt

2. **pyre** - Facebook's type checker
   ```json
   {
     "name": "python-types",
     "command": "cd api && pyre check"
   }
   ```
   Requires: `pyre-check>=0.9.0` in requirements.txt

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
      "name": "python-types",
      "command": "cd api && python -m mypy ."
    }
  ]
}
```

## Implementation Notes

- Initial run will likely require creating a `mypy.ini` or adding mypy config to suppress warnings
- Consider starting with basic checks: `--ignore-missing-imports` and gradually enable stricter modes
- FastAPI + Pydantic codebases benefit significantly from type checking
- Type stubs for third-party libraries may be needed: `types-*` packages
