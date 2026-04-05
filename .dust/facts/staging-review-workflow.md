# Staging review workflow

This fact defines how the team validates changes in staging before promoting to production.

## Access Staging

**Staging URL**: `https://umarell-staging.up.railway.app`

Anyone on the team can access staging — no special permissions needed. Just visit the URL.

## When to Review in Staging

Review in staging whenever:
- A new feature is complete
- A bug fix needs validation
- Changes affect core user flows (capture, research, briefing)
- Database migrations have been applied
- API or authentication logic has changed

Skip staging for:
- README or documentation-only changes
- Minor copy edits or styling tweaks that can be verified in development

## Staging Review Checklist

Before promoting to production, validate:

1. **Core flows work**
   - Submit an observation (text, voice, photo, screenshot, or URL)
   - Verify thesis formatting looks correct
   - Check that research completes and returns structured output
   - Generate a briefing and confirm quality

2. **Authentication works**
   - Test Google OAuth login flow
   - Verify session persists across page reloads

3. **No obvious errors**
   - Check browser console for JavaScript errors
   - Review Railway API logs for Python exceptions or warnings
   - Look for UI rendering issues or broken layouts

4. **Database state is clean**
   - If migrations ran, confirm schema changes applied correctly
   - Verify no data corruption or orphaned records

## Who Reviews

**Default reviewer**: Troy

If Troy is unavailable, any collaborator can review. The reviewer should:
- Follow the staging review checklist
- Test the specific feature or fix that changed
- Flag any issues in the team channel before production promotion

## Promotion Criteria

A change is ready for production when:
- Staging review checklist is complete
- No critical bugs or errors found
- Core user flows work end-to-end
- Team has been notified (if significant change)

## Promotion Process

Once staging is validated, promote to production:

```bash
git checkout production || git checkout -b production
git merge staging
git push origin production
```

See `DEPLOYMENT.md` for detailed production deployment steps and rollback procedures.

## Review Cadence

No fixed schedule. Promote to production when:
- A change is validated and ready
- Multiple changes have accumulated and been collectively tested
- A critical bug fix needs to go out quickly

Bias toward frequent, small promotions rather than large batches.

## Staging Data

Staging uses its own PostgreSQL database, separate from production. Data in staging is disposable — it's safe to:
- Create test observations
- Delete test data manually
- Reset the database if needed

Do not rely on staging data persisting long-term.
