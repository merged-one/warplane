# ADR-0001: Use Structured MADR for Architecture Decisions

## Status

Accepted

## Date

2026-04-01

## Context and Problem Statement

The Warplane project needs a lightweight, consistent way to record architecture decisions.
Decisions should be version-controlled alongside the code, readable by both humans and
automated tools, and easy to create without heavy process overhead.

## Decision Drivers

- Decisions must be discoverable and searchable in the repo
- Format should be lightweight enough for a small team
- Tooling and CI validation should be possible
- Both human contributors and AI agents will read and write ADRs

## Considered Options

1. Structured MADR (Markdown Any Decision Records)
2. Unstructured markdown notes in a wiki
3. ADR Tools (adr-tools shell scripts)
4. RFCs in a separate repo

## Decision Outcome

Chosen option: "Structured MADR", because it provides a well-defined template that is
both human-readable and machine-parseable, lives in the repo alongside code, and has
an active community and ecosystem.

### Consequences

**Good:**

- Consistent structure across all decisions
- CI-validatable (required sections can be checked)
- Easy to scaffold with a simple script
- Widely adopted in the ADR community

**Bad:**

- Template may feel heavy for trivial decisions
- Requires discipline to keep the index updated

**Neutral:**

- Numbering scheme (0001, 0002, ...) is simple but requires manual coordination

## Pros and Cons of the Options

### Structured MADR

- Good, because it has a clear template with required sections
- Good, because it is markdown and lives in the repo
- Good, because it supports CI validation
- Bad, because the template has many sections for small decisions

### Unstructured markdown notes

- Good, because it is zero-overhead
- Bad, because inconsistent format makes decisions hard to find and compare
- Bad, because no CI validation possible

### ADR Tools (adr-tools)

- Good, because it provides CLI tooling out of the box
- Bad, because it is shell-based and less portable
- Bad, because the template is less structured than MADR

### RFCs in a separate repo

- Good, because it separates discussion from implementation
- Bad, because it adds friction and context-switching
- Bad, because decisions drift from the code they describe

## More Information

- [MADR homepage](https://adr.github.io/madr/)
- [ADR GitHub organization](https://adr.github.io/)
