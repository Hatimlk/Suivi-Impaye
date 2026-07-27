interface SplitBarSegment {
  label: string;
  value: number;
  color: string;
}

interface SplitBarProps {
  segments: SplitBarSegment[];
  formatter?: (value: number) => string;
}

/**
 * Horizontal part-to-whole bar for a small number of categories — the
 * accessible, comparable alternative to a 2-3 slice pie/donut. Segments are
 * separated by a surface gap (never a stroke) and each carries a direct
 * label + value + share below, so identity never depends on color alone.
 */
export function SplitBar({ segments, formatter }: SplitBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full ring-1 ring-gray-100">
        {segments.map((s, i) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={s.label}
              className="h-full"
              style={{
                width: `${pct}%`,
                backgroundColor: s.color,
                marginLeft: i === 0 ? 0 : 2,
              }}
              title={`${s.label}: ${pct.toFixed(0)}%`}
            />
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {segments.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <div key={s.label} className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-gray-500">{s.label}</span>
              <span className="font-semibold text-gray-900 tabular-nums">
                {formatter ? formatter(s.value) : s.value}
              </span>
              <span className="text-gray-400 text-xs">({pct.toFixed(0)}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
