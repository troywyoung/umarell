# Check: Python Tests

Add pytest execution to dust checks for the Python/FastAPI backend.

## Detected Stack

- **Python backend** in `api/` directory
- **FastAPI** web framework
- **pytest** already installed and available
- **Test files** present: `test_*.py` files in `api/`

## Current Coverage Gap

The `.dust/config/settings.json` currently only has `npm test` which is a placeholder. Python tests are not being run as part of dust checks.

Evidence of pytest usage:
- `.pytest_cache` directory exists in `api/`
- Multiple test files: `test_config_persistence.py`, `test_instance_routing.py`, `test_podcast_automation.py`, `test_podcast_ingest.py`, `test_transcript_service.py`

## Suggested Check

```json
{
  "name": "python-tests",
  "command": "cd api && python -m pytest"
}
```

## Alternative Options

- `cd api && pytest` - Shorter form (requires pytest in PATH)
- `cd api && python -m pytest -v` - Verbose output
- `cd api && python -m pytest --tb=short` - Shorter tracebacks for cleaner output

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
      "name": "python-tests",
      "command": "cd api && python -m pytest"
    }
  ]
}
```
