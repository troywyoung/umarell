# Fix frontend build errors

The frontend build is failing with TypeScript errors and ESLint violations, blocking deployment and verification.

## Problem

Frontend build is currently failing:
- TypeScript error: `designTokens` declared but never used in `AdminPanel.tsx:48`
- TypeScript error: `loadSuiteDetails` declared but never used in `AdminPanel.tsx:290`

ESLint also reports 23 errors and 1 warning in AdminPanel.tsx, including:
- Multiple `@typescript-eslint/no-explicit-any` violations
- Unused variable violations
- React hooks rules violations

## Impact

- Build failures block deployment
- Agents cannot verify their changes build successfully
- Violates `stop-the-line` principle (defects in main branch)
- Violates `lint-everything` principle (failing static analysis)

## Current State

The lint check takes ~2.6 seconds, which is good for feedback loops, but it fails.

## Proposed Solution

1. Remove unused `designTokens` and `loadSuiteDetails` variables
2. Fix TypeScript `any` types with proper type definitions
3. Fix React hooks violations (hooks called in non-component function)
4. Add frontend build check to `npx dust check`
5. Add frontend lint check to `npx dust check`

## Related Principles

- stop-the-line
- lint-everything
- fast-feedback-loops
- broken-windows
- make-changes-with-confidence
