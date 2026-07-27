import { Loader2 } from 'lucide-react';
import { cn } from '../../utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('w-5 h-5 animate-spin text-brand-600', className)} />;
}

export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-96 gap-3 text-gray-500">
      <Spinner className="w-6 h-6" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
