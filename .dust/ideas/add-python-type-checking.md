# Add Python Type Checking

Add mypy static type checking to catch type errors in the Python backend before runtime.

## Context

The project has Python backend code in `api/` but no type checking configured in `.dust/config/settings.json`.

## Stack Indicators

- Python files in `api/` directory with type hints likely present
- `api/requirements.txt` includes `pydantic` which uses type annotations
- No `mypy.ini` or type checking configuration detected

## Recommendation

Add mypy for static type checking to catch type errors before runtime.

## Suggested Configuration

```json
{
  "name": "typecheck-python",
  "command": "cd api && mypy ."
}
```

## Alternative Options

1. **Pyright** - Fast type checker from Microsoft
   ```json
   {
     "name": "typecheck-python",
     "command": "cd api && pyright ."
   }
   ```

2. **Mypy with strict mode**
   ```json
   {
     "name": "typecheck-python",
     "command": "cd api && mypy --strict ."
   }
   ```

## Installation Required

Add to `api/requirements.txt`:
```
mypy==1.10.0
```

## Configuration Recommended

Create `api/mypy.ini`:
```ini
[mypy]
python_version = 3.11
warn_return_any = True
warn_unused_configs = True
disallow_untyped_defs = True
```
