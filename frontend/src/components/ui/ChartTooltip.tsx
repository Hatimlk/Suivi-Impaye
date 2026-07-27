interface ChartTooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  fill?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: ChartTooltipPayloadItem[];
  formatter?: (value: number) => string;
}

/**
 * Recharts custom tooltip content, styled as a small card. Values lead
 * (bold, high-contrast), series name follows (secondary) — inverted from
 * the legend, since the reader already has the mark and wants the number.
 */
export function ChartTooltip({ active, label, payload, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-lg shadow-gray-900/10 text-sm max-w-[240px]">
      {label && <p className="font-medium text-gray-900 mb-1 truncate">{label}</p>}
      <div className="space-y-1">
        {payload.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-[2px] rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color || item.fill }}
            />
            {item.name && <span className="text-gray-500 truncate">{item.name}</span>}
            <span className="ml-auto font-semibold text-gray-900 tabular-nums whitespace-nowrap">
              {typeof item.value === 'number' && formatter ? formatter(item.value) : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
