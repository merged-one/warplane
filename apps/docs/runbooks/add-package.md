# Adding a New Package

## Steps

### 1. Create the package directory

```bash
mkdir -p packages/my-package/src
```

### 2. Initialize package.json

```json
{
  "name": "@warplane/my-package",
  "version": "0.0.1",
  "private": true,
  "description": "What this package does",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -b",
    "clean": "rm -rf dist *.tsbuildinfo"
  }
}
```

### 3. Create tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src"]
}
```

### 4. Add to root project references

Edit `tsconfig.json` at the repo root:

```json
{
  "references": [{ "path": "packages/my-package" }]
}
```

### 5. Create the entry point

```bash
echo 'export {}' > packages/my-package/src/index.ts
```

### 6. Install and verify

```bash
pnpm install
pnpm build
pnpm test
```

## Conventions

- Package names use `@warplane/` scope
- Every package must have a `description` in `package.json`
- No placeholder TODOs without a backlog entry
- Use `workspace:*` for internal dependencies
