# Definition of Done

A feature, product, or release is **not** done because an AI says it's done. It is done when every item below is mechanically true — checkable by running a command or pointing at an artifact, not by asserting it in prose. This exists because there is no in-house QA team; the checklist *is* the QA team.

## Every feature (before merge)

- [ ] Requirements implemented — traced back to the PRD line that requested them (see [`workflow/02-prd.md`](workflow/02-prd.md))
- [ ] Architecture reviewed against [`workflow/03-architecture.md`](workflow/03-architecture.md) — no undocumented deviation from the chosen Technology Profile
- [ ] Code reviewed by the **Reviewer** role ([`roles/reviewer.md`](roles/reviewer.md)) — an AI acting as author never self-approves its own review step
- [ ] Automated tests written and **actually executed**, with the command and its output recorded — not "tests should pass," but a pasted pass result (see [`workflow/06-testing.md`](workflow/06-testing.md))
- [ ] Lint/typecheck/format hooks pass (see [`hooks/catalog.md`](hooks/catalog.md)) — zero errors, zero silently-ignored warnings
- [ ] No hardcoded secrets, no new dependency added without following [`../CLAUDE.md`-style dependency safety rules](governance/security-standards.md#dependencies)
- [ ] Documentation updated — the doc that describes this feature exists and is current, not scheduled for "later"
- [ ] Changelog entry added
- [ ] Quality gates in [`governance/quality-gates.md`](governance/quality-gates.md) passed
- [ ] Any decision on the [Approval Gates list](governance/approval-gates.md) has a recorded Founder Decision Brief and an explicit "approved" — silence is not approval

## Every release (before it reaches real users)

All of the above, plus:

- [ ] Pre-launch checklist in [`workflow/08-release.md`](workflow/08-release.md) run in full and blocking — a failed item stops the release, it does not get noted and shipped anyway
- [ ] Monitoring and error alerts are live and confirmed to actually reach the founder (per [`workflow/post-launch-operations.md`](workflow/post-launch-operations.md)) — verified with a real test alert, not assumed configured
- [ ] Backup/restore path exists and has been exercised at least once, not just described
- [ ] Cost is within the budget ceiling recorded in [`PRODUCT_REGISTRY.md`](PRODUCT_REGISTRY.md) for this product, or an explicit Founder Decision Brief approved the overage
- [ ] `PRODUCT_REGISTRY.md` entry for this product is updated (status, version, URL, stack, cost)

## Anti-patterns (automatic "not done")

- "The code looks correct" without a test run.
- A checklist item marked complete because a *previous* similar feature had it — each feature earns its own checkmarks.
- Documentation planned as a follow-up task after the code ships.
- An approval gate skipped because the change "seemed obviously fine."
- A test disabled, skipped, or its assertion loosened to make a suite pass.
