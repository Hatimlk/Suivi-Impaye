import type { ReactNode } from 'react';
import { cn } from '../../utils';
import type { SemanticTone } from '../../utils';

export type BadgeTone = SemanticTone | 'brand';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  pill?: boolean;
}

const toneClasses: Record<BadgeTone, string> = {
  brand: 'bg-brand-100 text-brand-700',
  danger: 'bg-danger-100 text-danger-700',
  warning: 'bg-warning-100 text-warning-700',
  success: 'bg-success-100 text-success-700',
  info: 'bg-info-100 text-info-700',
  neutral: 'bg-neutral-100 text-neutral-700',
};

export function Badge({ tone = 'neutral', children, className, pill = true }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium',
        pill ? 'rounded-full' : 'rounded',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
