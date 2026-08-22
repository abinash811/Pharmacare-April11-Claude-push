# Engineering OS — Version

**Current version:** 1.0.0
**Released:** 2026-08-22

## What "breaking" means for this OS

A change is **major/breaking** if a product built against a prior version would need to change *its own* files (not just re-sync docs) to stay compliant. Examples:
- Renaming or removing a Role, Skill, or governance rule a product's `CLAUDE.md` (or equivalent) references by name.
- Changing the Idea → PRD → Architecture → Design → Development → Testing → Review → Release lifecycle stage names or their required outputs.
- Changing the Documentation Standard's required fields in a way that invalidates existing docs.
- Changing an Approval Gate from "required" to "not required" or vice versa for an existing decision category.

A change is **minor** if it adds a new Role, Skill, Domain Pack, Technology Profile, Component Library entry, or Hook without altering existing ones.

A change is **patch** if it only clarifies wording, fixes an error, or improves an example without changing required behavior.

## Compatibility promise

Products pin the Engineering OS version they were built against (recorded in that product's own onboarding doc). A major version bump requires a migration guide in `CHANGELOG.md` before any active product is asked to upgrade.
