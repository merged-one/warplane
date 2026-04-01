# ADR-0004: Zod as Single Schema Source for Domain Model

## Status

Accepted

## Date

2026-04-01

## Context and Problem Statement

The Interchain Control Plane needs a canonical domain model shared across the API server,
CLI, web dashboard, documentation site, and MCP server. We need runtime validation,
TypeScript types, JSON Schema output, and OpenAPI component definitions -- all derived
from one source of truth. Maintaining separate type definitions and validation logic
is error-prone and drifts over time.

## Decision Drivers

- Single source of truth for types and validation across 5+ consumers
- Must generate JSON Schema for external tooling and documentation
- Must produce OpenAPI 3.1 components for the API spec
- Zod v4 is already in the dependency tree (used by `@warplane/docs-mcp`)
- TypeBox was considered but requires a different mental model and has a smaller ecosystem
- Runtime validation is needed to validate golden fixtures and future live ingestion

## Considered Options

1. Zod v4 with built-in `z.toJSONSchema()` for JSON Schema and OpenAPI generation
2. TypeBox (JSON Schema-first, derives TypeScript types)
3. Hand-written TypeScript interfaces + AJV for JSON Schema validation
4. io-ts or Effect Schema

## Decision Outcome

Chosen option: "Zod v4", because it provides the best developer ergonomics for our team,
is already in the dependency tree, and Zod v4's built-in `z.toJSONSchema()` eliminates
the need for a separate conversion library. The discriminated union support maps cleanly
to our MessageEvent model.

### Consequences

**Good:**

- One schema definition produces TypeScript types, runtime validation, JSON Schema, and OpenAPI components
- Familiar API for TypeScript developers
- Strong discriminated union support for the event model
- Zod v4's built-in JSON Schema generation means no third-party conversion library needed
- Checked-in generated artifacts make schema changes visible in code review

**Bad:**

- Zod schemas are TypeScript-only; Go harness must maintain its own types (mitigated by fixture validation)
- `z.toJSONSchema()` output may not perfectly match hand-tuned JSON Schema in all edge cases
- Zod v4 is newer and may have undiscovered issues

**Neutral:**

- Schema versioning via `schemaVersion` field allows forwards-compatible evolution
- Generated JSON Schema files are checked in, creating a review checkpoint

## Pros and Cons of the Options

### Zod v4

- Good, because already in dependency tree
- Good, because built-in JSON Schema generation
- Good, because excellent discriminated union support
- Good, because familiar API
- Bad, because TypeScript-only (Go must maintain separate types)

### TypeBox

- Good, because JSON Schema-first design
- Good, because very fast runtime validation
- Bad, because smaller ecosystem and less familiar API
- Bad, because not already in the dependency tree

### Hand-written interfaces + AJV

- Good, because maximum control over JSON Schema output
- Bad, because maintaining types and schemas separately is error-prone
- Bad, because no single source of truth

### io-ts / Effect Schema

- Good, because strong type-level guarantees
- Bad, because steep learning curve
- Bad, because smaller ecosystem

## More Information

- [Trace model runbook](../runbooks/trace-model.md)
- [Domain package source](../../packages/domain/src/)
- [Generated schemas](../../packages/domain/generated/)
