/** Horizontal percentage bar for connected stake weight per subnet. */

export function StakeWeightBar({ label, percent }: { label: string; percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const color = clamped >= 80 ? "var(--green)" : clamped >= 67 ? "var(--orange)" : "var(--red)";

  return (
    <div className="stake-bar">
      <span className="stake-bar-label">{label}</span>
      <div className="stake-bar-track">
        <div className="stake-bar-fill" style={{ width: `${clamped}%`, background: color }} />
      </div>
      <span className="stake-bar-value">{Math.round(percent)}%</span>
    </div>
  );
}
