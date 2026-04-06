# Add frontend test coverage

The frontend has zero test coverage, preventing agents from verifying changes and violating core testing principles.

## Problem

The frontend (`app/`) has zero test coverage:
- No test files exist in `app/src/`
- No test script in `app/package.json`
- No testing framework installed

This violates multiple principles:
- `comprehensive-test-coverage`: "A project's test suite is its primary safety net"
- `make-changes-with-confidence`: Agents cannot verify their changes work
- `fast-feedback`: No automated verification of frontend behavior

## Impact

- Agents cannot verify frontend changes without manual testing
- No automated detection of regressions
- Slower feedback loops for UI work
- Higher risk of breaking changes

## Proposed Solution

1. Install Vitest (integrates well with Vite)
2. Add test script to `app/package.json`
3. Create test files co-located with components (following `co-located-tests`)
4. Start with critical paths: observation submission, briefing generation
5. Add to `npx dust check` workflow

## Related Principles

- comprehensive-test-coverage
- co-located-tests
- make-changes-with-confidence
- fast-feedback
- design-for-testability
