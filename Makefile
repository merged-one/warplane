.PHONY: bootstrap build test check demo-day1 e2e e2e-compile golden golden-verify clean

bootstrap:
	pnpm install
	cd harness/tmpnet && go mod download

build: bootstrap
	pnpm build
	cd harness/tmpnet && go build ./...

test:
	pnpm test
	cd harness/tmpnet && go test ./...

check:
	pnpm run check

# Compile-only check for the Go E2E harness (no binaries required).
e2e-compile:
	cd harness/tmpnet && go test -run ^$$ -count=0 ./...
	cd harness/tmpnet && go vet ./...
	@echo "e2e-compile: harness compiles and passes vet"

# Full E2E run — requires AvalancheGo and subnet-evm binaries.
# See docs/runbooks/full-e2e.md for prerequisites.
e2e:
	cd harness/tmpnet && RUN_E2E=1 go test -v -timeout 10m ./...

# Generate deterministic golden trace fixtures (no binaries needed).
golden:
	cd harness/tmpnet && go run ./cmd/generate-golden --output-dir artifacts

# Verify golden fixtures match regenerated output.
golden-verify:
	cd harness/tmpnet && go run ./cmd/generate-golden --output-dir /tmp/warplane-golden-verify
	diff -r --exclude='.gitkeep' harness/tmpnet/artifacts /tmp/warplane-golden-verify
	@echo "golden-verify: fixtures match"

demo-day1:
	bash scripts/demo-day1.sh

clean:
	pnpm -r run clean
	rm -rf node_modules
	rm -rf harness/tmpnet/artifacts/scenarios harness/tmpnet/artifacts/traces
