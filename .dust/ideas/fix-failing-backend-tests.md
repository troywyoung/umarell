# Fix failing backend tests

The backend test suite has 38 failing tests due to SQLAlchemy errors, preventing agents from using tests for verification.

## Problem

Backend test suite is failing:
- 38 tests failing
- 17 tests passing
- Failures appear to be SQLAlchemy errors across multiple test files

Test execution takes ~10 seconds, which is reasonable, but the failures prevent agents from using tests as verification.

## Impact

- Agents cannot trust test results for verification
- Violates `make-changes-with-confidence` principle
- Test suite provides negative value (noise instead of signal)
- Breaks the feedback loop that agents depend on

## Root Cause (Needs Investigation)

All failures show SQLAlchemy errors, suggesting:
- Database setup/teardown issues
- Missing test database configuration
- Fixture problems
- Environment configuration missing

## Proposed Solution

1. Investigate SQLAlchemy errors in test output
2. Fix database setup for tests (likely missing async session handling)
3. Ensure tests follow `environment-independent-tests` principle
4. Add backend tests to `npx dust check` once passing
5. Document test database requirements

## Related Principles

- comprehensive-test-coverage
- make-changes-with-confidence
- environment-independent-tests
- test-isolation
- fast-feedback-loops
