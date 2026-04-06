# Add Python Tests Check

Configure pytest check to run Python unit tests and ensure backend code quality.

## Context

The project has pytest test files in `api/` (e.g., `test_config_persistence.py`, `test_instance_routing.py`, `test_podcast_automation.py`) but no pytest check configured in `.dust/config/settings.json`.

## Stack Indicators

- `.pytest_cache` directory present in both root and `api/`
- Multiple `test_*.py` files in `api/` directory
- No pytest configuration in current checks

## Recommendation

Add pytest to run Python unit tests.

## Suggested Configuration

```json
{
  "name": "test-python",
  "command": "cd api && pytest"
}
```

## Alternative Options

1. **Pytest with coverage**
   ```json
   {
     "name": "test-python",
     "command": "cd api && pytest --cov=. --cov-report=term-missing"
   }
   ```

2. **Pytest verbose mode**
   ```json
   {
     "name": "test-python",
     "command": "cd api && pytest -v"
   }
   ```

3. **Pytest with parallel execution**
   ```json
   {
     "name": "test-python",
     "command": "cd api && pytest -n auto"
   }
   ```

## Installation Required

Pytest is likely already available since `.pytest_cache` exists, but ensure it's in dependencies:

Add to `api/requirements.txt`:
```
pytest==8.2.0
pytest-asyncio==0.23.0
```

Optional for coverage:
```
pytest-cov==5.0.0
```

Optional for parallel execution:
```
pytest-xdist==3.6.0
```
