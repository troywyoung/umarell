# Python Testing Check

Add pytest check to run the backend test suite.

## Context

The project has a Python backend in `api/` with pytest tests (evidenced by `.pytest_cache` and `test_*.py` files). Currently there's no pytest check configured.

## Detected Stack Indicators

- `api/.pytest_cache/` exists
- Multiple test files found: test_config_persistence.py, test_podcast_ingest.py, test_instance_routing.py, test_podcast_automation.py, test_transcript_service.py
- FastAPI application (main.py)

## Suggested Check

Add to `.dust/config/settings.json`:

```json
{
  "name": "test:backend",
  "command": "cd api && python -m pytest"
}
```

## Alternative Options

- Add pytest to requirements.txt if not already there
- Add pytest configuration file (pytest.ini or pyproject.toml) for test discovery settings
- Use coverage reporting: `cd api && python -m pytest --cov=.`

## Considerations

- Need to ensure pytest is installed (should be in requirements.txt or requirements-dev.txt)
- May need to set PYTHONPATH or test environment variables

## Benefits

- Catch regressions early
- Ensure API endpoints work correctly
- Validate database interactions and business logic
