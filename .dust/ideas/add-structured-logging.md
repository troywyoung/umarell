# Add structured logging

Logging infrastructure is minimal and inconsistent, making it difficult for agents to observe system behavior and debug issues.

## Problem

Logging infrastructure is minimal and inconsistent:
- API uses Python's logging module in only 3 files (`main.py`, `whatsapp.py`, `sms.py`)
- Frontend has no observable logging system
- No structured logging format (JSON, contextual fields)
- No log levels strategy documented
- Agents cannot observe system behavior through logs

## Impact

- Difficult for agents to debug issues without running the system
- No visibility into pipeline execution, API calls, or errors
- Cannot trace observation flow through the system
- Violates `ideal-agent-developer-experience` principle

## Proposed Solution

### Backend
1. Configure structured logging with JSON formatter
2. Add logging to key execution paths:
   - Observation formatting (input → thesis)
   - Research execution (searches, API calls)
   - Briefing generation
   - Pipeline stages
3. Include contextual fields: `observation_id`, `user_id`, `stage`, `duration`
4. Add log level guidelines (INFO for flow, DEBUG for details, ERROR for failures)

### Frontend
1. Add console wrapper for structured logging
2. Log user actions, API calls, state changes
3. Include request IDs to correlate with backend logs

### Documentation
- Create fact documenting logging strategy
- Include examples of how agents can use logs for debugging

## Related Principles

- ideal-agent-developer-experience
- self-diagnosing-tests (similar: self-diagnosing behavior)
- actionable-errors
