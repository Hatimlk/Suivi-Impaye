import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full py-2 border rounded-lg text-sm outline-none transition',
              'focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
              icon ? 'pl-10 pr-4' : 'px-3',
              error ? 'border-danger-600' : 'border-gray-300',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-xs text-danger-700">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
