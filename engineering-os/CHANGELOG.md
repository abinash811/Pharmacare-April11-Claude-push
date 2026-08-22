# Engineering OS — Changelog

All notable changes to Engineering OS are recorded here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/). See [`VERSION.md`](VERSION.md) for what counts as major/minor/patch.

## [1.0.0] — 2026-08-22

### Added
- Initial Engineering OS v1: Company philosophies, Governance, Workflow lifecycle (Idea → Release), Technology Profile catalog + decision framework, Domain Packs (Pharmacy fully written; Healthcare, Government, CRM stubs), 12 Roles, Skills catalog, Hooks, Component Library, Memory module, Documentation standards, Product Templates.
- Fork-per-product model: this repo is the canonical template; each product forks it and picks its own Technology Profile.
- `PRODUCT_REGISTRY.md` — portfolio view across all products ever forked from this OS.
- `governance/os-sync.md` — process for pulling canonical OS improvements into an existing product fork.
- `governance/cost-governance.md` and `governance/secrets-custody.md` — added for a non-technical, cost-sensitive solo founder running many products.
- `workflow/00-new-product-intake.md` and `workflow/founder-decision-brief-template.md` — the founder-facing on-ramp; every approval gate now produces a plain-language brief, not a raw technical doc.
- `workflow/post-launch-operations.md` and `workflow/support-intake.md` — day-2 operations, since there is no in-house ops/support team.

### Scope explicitly deferred to v2
- Business OS, marketing, sales, pricing, GTM, customer feedback automation, product analytics workflows.

## Version History Summary

| Version | Date | Type | Summary |
|---|---|---|---|
| 1.0.0 | 2026-08-22 | Major (initial) | First working version of Engineering OS |
