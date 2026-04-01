# ADR-0001: Use Structured MADR for Architecture Decisions

## Status

Accepted (2026-04-01)

## Context

The project needs a lightweight, consistent way to record architecture decisions that is version-controlled, readable by humans and automated tools, and easy to create.

## Decision

Use Structured MADR format. It provides a well-defined template that is human-readable and machine-parseable, lives in the repo alongside code, and has an active community.

## Consequences

- Consistent structure across all decisions
- CI-validatable (required sections can be checked)
- Template may feel heavy for trivial decisions

Source: `docs/decisions/0001-use-structured-madr.md`
