# Python Type Checking

Add mypy type checking for the Python backend.

## Context

The Python backend uses FastAPI which supports type hints, and modern Python best practices include type checking. No type checker is currently configured.

## Detected Stack Indicators

- Python files in `api/` directory
- FastAPI application (benefits heavily from type hints)
- Pydantic models in schemas.py and models (type validation)

## Suggested Check

**Option 1: Mypy** (standard type checker)

Add to `.dust/config/settings.json`:

```json
{
  "name": "typecheck:backend",
  "command": "cd api && python -m mypy ."
}
```

Requires adding `mypy` to requirements.txt or requirements-dev.txt.

**Option 2: Pyright** (Microsoft's type checker, faster)

```json
{
  "name": "typecheck:backend",
  "command": "cd api && npx pyright"
}
```

Pyright is a Node.js tool but works on Python code.

## Alternative Options

- **Pytype** (Google's type checker, can infer types)
- Skip type checking if codebase doesn't use type hints extensively

## Configuration Needed

May need a `mypy.ini` or `pyproject.toml` configuration to:
- Ignore third-party libraries without type stubs
- Set strictness level
- Exclude certain files or directories

## Recommendation

Start with mypy - it's the most widely adopted and works well with FastAPI.

## Benefits

- Catch type-related bugs before runtime
- Improve code documentation
- Better IDE support and autocomplete
- Validate FastAPI endpoint signatures
