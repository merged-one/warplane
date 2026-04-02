export function DemoBanner() {
  return (
    <div className="demo-banner">
      <strong>Demo mode</strong> — Data may be fixture-seeded. Run <code>pnpm ingest:fixtures</code>{" "}
      to reload golden artifacts, or connect a live tmpnet for real traces.
    </div>
  );
}
