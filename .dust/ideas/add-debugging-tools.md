# Add debugging tools

Agents lack dedicated tools to diagnose issues efficiently, forcing them to rely on trial and error instead of systematic debugging.

## Problem

Agents currently lack debugging tools to diagnose issues efficiently:
- No way to inspect observation pipeline execution without running full system
- No mock data generators for testing individual pipeline stages
- No CLI tools to replay failed observations
- No validation tools for API responses
- Trial and error is the primary debugging method

## Impact

- Agents spend excessive context on debugging
- Cannot isolate and reproduce issues efficiently
- Violates `ideal-agent-developer-experience` principle
- Increases risk of introducing new bugs while fixing old ones

## Proposed Solution

### Development CLI Tools

1. **Pipeline debugger**: Run individual stages in isolation
   ```bash
   python -m umarell.debug format "raw observation text"
   python -m umarell.debug research "formatted thesis"
   python -m umarell.debug brief --observation-id abc123
   ```

2. **Mock data generators**: Create realistic test data
   ```bash
   python -m umarell.fixtures observation > test_obs.json
   python -m umarell.fixtures research-results > test_research.json
   ```

3. **Replay tool**: Re-run failed observations
   ```bash
   python -m umarell.replay observation abc123
   ```

### Validation Tools

1. Add schema validators for all API payloads
2. Add assertion helpers for test data
3. Add type guards for TypeScript/Python boundaries

### Inspection Tools

1. Add endpoint to dump pipeline state for an observation
2. Add request/response logging mode for development
3. Add timing breakdowns for each pipeline stage

## Related Principles

- ideal-agent-developer-experience
- fast-feedback-loops
- self-diagnosing-tests
- design-for-testability
