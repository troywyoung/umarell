# Improve check feedback loop

The current check workflow is fast but incomplete, missing critical verification steps that agents need for confidence.

## Problem

Current `npx dust check` only runs 2 checks:
1. Lint `.dust` directory
2. Test (but root `package.json` test script is a placeholder that always passes)

This misses critical feedback:
- Backend tests (5 test files, but not in check workflow)
- Frontend lint (exists, takes 2.6s, but not in check workflow)
- Frontend build (catches TypeScript errors, but not in check workflow)
- Backend code quality checks (no linting configured)

Current check time: ~1 second (fast, but incomplete)

## Impact

- Agents don't get automatic feedback on code quality
- Can commit broken builds without detection
- Violates `fast-feedback-loops` principle (feedback exists but isn't in the loop)
- Violates `reproducible-checks` principle (checks should catch what CI would catch)

## Proposed Solution

1. **Fix existing issues first** (see related ideas):
   - Fix failing backend tests
   - Fix frontend build/lint errors

2. **Add checks to dust workflow**:
   - Backend: pytest (when passing)
   - Backend: add ruff or pylint for Python linting
   - Frontend: `npm run build` in app/
   - Frontend: `npm run lint` in app/

3. **Optimize for speed**:
   - Run checks in parallel where possible
   - Consider pytest markers for fast vs slow tests
   - Document expected check duration

4. **Update check configuration**:
   - Add check scripts to root `package.json` or use dust check config
   - Ensure checks work across environments (macOS, Linux)

## Target State

- `npx dust check` runs all verification in < 15 seconds
- All checks pass consistently
- Agents can trust check results before committing

## Related Ideas

- fix-failing-backend-tests.md
- fix-frontend-build-errors.md

## Related Principles

- fast-feedback-loops
- reproducible-checks
- make-changes-with-confidence
- stop-the-line
