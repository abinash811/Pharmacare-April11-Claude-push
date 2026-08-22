# Engineering OS

**Version:** 1.0.0
**Status:** Version 1 — product-building only. Business OS, GTM, sales, pricing, and analytics workflows are out of scope until Version 2.

## What this is

Engineering OS is the Company's engineering operating system: a reusable, AI-model-agnostic platform that lets a single founder build multiple production-grade software products with the discipline of a professional software company, without personally doing product planning, architecture, design, development, testing, documentation, governance, or deployment prep.

Engineering OS is not a prompt library, an agent collection, Claude-specific instructions, or a no-code platform. It is a company handbook, a knowledge base, a workflow engine, and a software factory — expressed as documents any competent AI model (or human) can execute against.

The founder owns: product vision, business problems, customer validation, revenue, and every decision behind a [human approval gate](governance/approval-gates.md).
Engineering OS owns: everything else in the [product lifecycle](workflow/README.md).

## The fork model

This repository is the **canonical template**. It is never a product itself.

- **Starting a new product** = fork this repo → follow [`workflow/00-new-product-intake.md`](workflow/00-new-product-intake.md) → the fork becomes that product's real repo, carrying its own code alongside its pinned copy of the OS.
- Every product picks its own [Technology Profile](technology-profiles/README.md) fresh, at fork time, from the current catalog — the catalog grows as better stacks emerge, nothing here is hardcoded to one stack forever.
- Because forks diverge, two loops keep them from rotting in isolation:
  - **[`governance/os-sync.md`](governance/os-sync.md)** — how an existing product fork pulls in improvements made to the canonical OS after it forked.
  - **[`memory/README.md`](memory/README.md)** — how a lesson learned inside one product's fork gets contributed back to the canonical OS so every future fork starts smarter.
- **[`PRODUCT_REGISTRY.md`](PRODUCT_REGISTRY.md)** (kept in the canonical repo, and mirrored manually as each product ships) is the single-glance list of every product ever forked from this OS — status, stack, version, cost, URL.

## How to use this OS

1. **Starting a new product?** Read [`workflow/00-new-product-intake.md`](workflow/00-new-product-intake.md) first.
2. **Working on an existing product's fork?** Read [`workflow/ai-bootstrapping.md`](workflow/ai-bootstrapping.md) — it tells an AI model exactly which files to load before touching code.
3. **Adding a new capability to the canonical OS itself?** Read [`governance/folder-structure.md`](governance/folder-structure.md) and [`documentation/documentation-standard.md`](documentation/documentation-standard.md), then add through the correct module below — never duplicate knowledge across modules.

## Modules

| # | Module | Purpose |
|---|--------|---------|
| 1 | [`company/`](company/) | Vision, mission, and the five philosophies (engineering, product, design, documentation, AI) |
| 2 | [`governance/`](governance/) | Company-wide standards, approval gates, quality gates, escalation |
| 3 | [`workflow/`](workflow/) | The Idea → PRD → Architecture → Design → Development → Testing → Review → Release lifecycle |
| 4 | [`technology-profiles/`](technology-profiles/) | Stack-specific implementation knowledge, swappable without touching the Company OS |
| 5 | [`domain-packs/`](domain-packs/) | Reusable business/domain knowledge (terminology, workflows, entities, regulations) |
| 6 | [`roles/`](roles/) | The 12 company roles — responsibilities, not knowledge |
| 7 | [`skills/`](skills/) | Reusable engineering expertise, shared across roles |
| 8 | [`hooks/`](hooks/) | Deterministic automation — no reasoning, ever |
| 9 | [`component-library/`](component-library/) | Reusable implementation patterns, reuse-before-rebuild |
| 10 | [`memory/`](memory/) | Engineering memory — lessons, patterns, recurring issues |
| 11 | [`documentation/`](documentation/) | Documentation standards, ADRs, guides |
| 12 | [`templates/`](templates/) | Starter bundles for new products |

Plus: [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md), [`CHANGELOG.md`](CHANGELOG.md), [`VERSION.md`](VERSION.md).

## Core principles

1. Build products, not demos.
2. Reuse before rebuilding.
3. Production-ready by default.
4. Simplicity over unnecessary complexity.
5. Technology agnostic — the Company OS never knows what stack a product uses.
6. Documentation is mandatory — part of the Definition of Done, not an afterthought.
7. Quality is designed into every phase, not bolted on at the end.
8. AI assists execution; the founder approves strategic decisions.
9. Every completed product improves the Operating System.

## Model-agnosticism

Every file in this OS is written to be executed by any capable AI model (Claude, GPT, Gemini, or future models) or by a human. Nothing here assumes a specific model's tool names, context window, or prompt format. Model-specific execution details (e.g., how a particular CLI loads a `CLAUDE.md`) live in that product's own repo, never inside Engineering OS itself.

## Versioning

Engineering OS is itself a product and follows [Semantic Versioning](https://semver.org/):
- **Major** — a change that breaks how existing products consume the OS (e.g., renaming a Role, restructuring the workflow lifecycle, removing a governance rule a product depends on).
- **Minor** — a new module, Skill, Domain Pack, or Technology Profile that is additive and backward compatible.
- **Patch** — corrections, clarifications, and non-breaking content updates.

See [`CHANGELOG.md`](CHANGELOG.md) for history and [`VERSION.md`](VERSION.md) for the current version and what "breaking" means in practice.
