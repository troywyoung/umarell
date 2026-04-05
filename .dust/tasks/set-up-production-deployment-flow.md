# Set up production deployment flow

Set up a safe production deployment path after staging is in place.

Configure production deployment so releases can be promoted intentionally after validation in staging. Include rollback guidance or the hosting platform's rollback mechanism if available.

## Task Type

implement

## Blocked By

- [Create Staging Environment](create-staging-environment.md)


## Definition of Done

- Production deployment is configured separately from staging
- The trigger for production deploys is documented and intentional
- Rollback or recovery steps are documented
- The deployment flow from staging review to production release is documented
