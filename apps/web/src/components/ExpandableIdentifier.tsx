import { useState } from "react";

export interface ShortenIdentifierOptions {
  head?: number;
  tail?: number;
}

export function shortenIdentifier(value: string, options: ShortenIdentifierOptions = {}): string {
  const head = options.head ?? 10;
  const tail = options.tail ?? 8;

  if (value.length <= head + tail + 3) {
    return value;
  }

  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function ExpandableIdentifier({
  value,
  head = 10,
  tail = 8,
  className,
}: {
  value: string;
  head?: number;
  tail?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = value.length > head + tail + 3;
  const displayValue = expanded || !canExpand ? value : shortenIdentifier(value, { head, tail });

  return (
    <div className={["expandable-identifier", className].filter(Boolean).join(" ")}>
      <span
        className="mono expandable-identifier-text"
        data-expanded={expanded || !canExpand}
        title={!expanded && canExpand ? value : undefined}
      >
        {displayValue}
      </span>
      {canExpand && (
        <button
          type="button"
          className="btn btn-sm trace-action-btn expandable-identifier-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Show less" : "Show full"}
        </button>
      )}
    </div>
  );
}
