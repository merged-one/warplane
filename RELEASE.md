# Release Process

## Versioning

Warplane uses [Semantic Versioning](https://semver.org/) (SemVer):

- **Major** (X.0.0): Breaking API or domain model changes
- **Minor** (0.X.0): New features, backward-compatible
- **Patch** (0.0.X): Bug fixes, backward-compatible

During Milestone 1, the version is `0.0.x` (pre-release). No stability guarantees.

## Release steps

### 1. Pre-release checks

```bash
make build          # All packages build
make test           # All tests pass
make check          # Lint + typecheck clean
```

### 2. Update version

Update version in `package.json` (root and relevant packages):

```bash
pnpm version patch  # or minor / major
```

### 3. Update changelog

Document changes in commit messages. Summarize notable changes in release notes.

### 4. Tag and push

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin main --tags
```

### 5. Create GitHub release

```bash
gh release create vX.Y.Z --generate-notes
```

### 6. Post-release

- Update `docs/planning/status.md` with release milestone
- Close completed milestone in GitHub Issues
- Update `docs/planning/work-items.yaml` statuses

## Hotfix process

1. Branch from the release tag: `git checkout -b hotfix/vX.Y.Z+1 vX.Y.Z`
2. Apply fix, test, and version bump
3. Merge to `main` and tag

## Package publishing

Individual packages are not yet published to npm. When they are, each package
will have its own version in its `package.json` and will be published via
`pnpm publish --filter <package>`.
