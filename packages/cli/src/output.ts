/**
 * Output helpers for TTY tables and JSON mode.
 *
 * When stdout is a TTY and --json is not set, we render aligned tables.
 * Otherwise we emit newline-delimited JSON.
 */

/** Global output mode flag. Set by the root command's --json option. */
let jsonMode = false;

export function setJsonMode(enabled: boolean): void {
  jsonMode = enabled;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

/** Print an object as JSON and exit. */
export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/** Print a section header (only in TTY mode). */
export function heading(text: string): void {
  if (jsonMode) return;
  console.log(`\n${text}`);
  console.log("─".repeat(text.length));
}

/** Print a key-value detail line (only in TTY mode). */
export function detail(label: string, value: string | number | boolean | undefined | null): void {
  if (jsonMode) return;
  const display = value === undefined || value === null ? "—" : String(value);
  console.log(`  ${label.padEnd(24)} ${display}`);
}

/** Render an aligned table. Columns are auto-sized. */
export function table(headers: string[], rows: string[][]): void {
  if (rows.length === 0) {
    console.log("  (no results)");
    return;
  }

  const widths = headers.map((h, i) => {
    const max = Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length));
    return Math.min(max, 60); // cap column width
  });

  const pad = (s: string, w: number) => s.slice(0, w).padEnd(w);
  const sep = "  ";

  console.log(headers.map((h, i) => pad(h, widths[i] ?? 10)).join(sep));
  console.log(widths.map((w) => "─".repeat(w)).join(sep));
  for (const row of rows) {
    console.log(row.map((c, i) => pad(c ?? "", widths[i] ?? 10)).join(sep));
  }
}

/** Print a hint (dimmed in TTY mode). */
export function hint(text: string): void {
  if (jsonMode) return;
  const isTTY = process.stdout.isTTY;
  if (isTTY) {
    console.log(`\n\x1b[2m${text}\x1b[0m`);
  } else {
    console.log(`\n${text}`);
  }
}

/** Print a status line with a colored symbol. */
export function status(ok: boolean, label: string, detail?: string): void {
  if (jsonMode) return;
  const sym = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
  const extra = detail ? ` — ${detail}` : "";
  console.log(`  ${sym} ${label}${extra}`);
}

/** Print a warning status line. */
export function warn(label: string, detail?: string): void {
  if (jsonMode) return;
  const sym = "\x1b[33m!\x1b[0m";
  const extra = detail ? ` — ${detail}` : "";
  console.log(`  ${sym} ${label}${extra}`);
}

/** Truncate a string, adding ellipsis if needed. */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

/** Format a short message ID for table display (first 12 chars). */
export function shortId(id: string): string {
  return id.length > 16 ? id.slice(0, 12) + "…" : id;
}
