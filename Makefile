.PHONY: bootstrap build test check demo-day1 e2e clean

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

demo-day1:
	bash scripts/demo-day1.sh

e2e:
	@echo "e2e: not yet wired — see docs/planning/backlog.md"

clean:
	pnpm -r run clean
	rm -rf node_modules
