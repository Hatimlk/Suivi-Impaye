import type { ReactNode } from 'react';
import { cn } from '../../utils';
import type { SemanticTone } from '../../utils';
import { Card } from './Card';

interface KpiCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: SemanticTone | 'brand';
}

const toneClasses: Record<string, { bg: string; text: string }> = {
  brand: { bg: 'bg-brand-50', text: 'text-brand-600' },
  danger: { bg: 'bg-danger-50', text: 'text-danger-600' },
  warning: { bg: 'bg-warning-50', text: 'text-warning-600' },
  success: { bg: 'bg-success-50', text: 'text-success-600' },
  info: { bg: 'bg-info-50', text: 'text-info-600' },
  neutral: { bg: 'bg-neutral-100', text: 'text-neutral-700' },
};

export function KpiCard({ label, value, icon, tone = 'brand' }: KpiCardProps) {
  const { bg, text } = toneClasses[tone];
  return (
    <Card className="flex items-center gap-4 transition-shadow hover:shadow-md hover:shadow-gray-900/5">
      <div className={cn('p-3 rounded-lg', bg, text)}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className={cn('text-2xl font-bold', tone === 'brand' ? 'text-gray-900' : text)}>{value}</p>
      </div>
    </Card>
  );
}
