---
name: release-promotion
description: Assess, create, merge, and verify DentivoHQ staging-to-main promotion pull requests and guarded GitHub releases.
---

# DentivoHQ Release Promotion

Use this workflow only for `staging` to `main` promotions or GitHub release publication.

## Promotion assessment

1. Fetch remote refs and tags without changing the working tree.
2. Identify the latest release tag and inspect every commit from that tag through `staging`.
3. Verify that `staging` contains the intended changes and that required CI checks pass.
4. Report `release required` when the promotion changes application behavior, contracts, schema, dependencies, or deployment configuration; otherwise report `release not required` with evidence.
5. When a release is required, recommend `patch`, `minor`, or `major` from the actual compatibility impact. Never silently select the bump.

## Guarded actions

- Creating or merging a promotion PR requires an explicit user request for that action.
- Publishing a GitHub release requires the user to name or confirm the version bump.
- Never bypass branch protection, required checks, or release approvals.
- Never include secrets, environment values, private URLs, or patient/clinic data in PR or release text.

## Post-merge verification

After a promotion merge, verify the merge SHA on `main` and state that production deployment is automatic while GitHub release publication is separate. When release publication is authorized, run the repository Release workflow and verify the resulting tag, GitHub release, production SHA, and health endpoint before reporting success. Stop and report evidence if any verification fails.
