# Python Linting Check

Add Python linting check using Ruff or Flake8 for code quality.

## Context

The Python backend in `api/` has no linting tool configured. Python linting helps catch code quality issues, style violations, and potential bugs.

## Detected Stack Indicators

- Python files in `api/` directory
- FastAPI application
- No existing linting configuration found (no .flake8, .ruff.toml, .pylintrc, pyproject.toml)

## Suggested Check

**Option 1: Ruff** (modern, fast, recommended)

Add to `.dust/config/settings.json`:

```json
{
  "name": "lint:backend",
  "command": "cd api && python -m ruff check ."
}
```

Requires adding `ruff` to requirements.txt or requirements-dev.txt.

**Option 2: Flake8** (traditional, widely used)

```json
{
  "name": "lint:backend",
  "command": "cd api && python -m flake8 ."
}
```

Requires adding `flake8` to requirements.txt.

## Alternative Options

- **pylint**: More comprehensive but slower
- **pycodestyle**: Only PEP 8 style checking
- Combine multiple tools

## Recommendation

Use Ruff - it's significantly faster than other options and includes most flake8 plugins plus automatic fixes.

## Benefits

- Enforce PEP 8 style guidelines
- Catch common Python mistakes
- Maintain consistent code quality
- Prevent potential bugs
