import type { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Input({
  label,
  error,
  icon,
  fullWidth = false,
  className = '',
  id,
  ...rest
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
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
          id={inputId}
          className={[
            'h-10 px-4 rounded-lg border bg-white text-sm transition-all duration-200 outline-none',
            'focus:ring-2 focus:ring-navy/20 focus:border-navy',
            icon ? 'pl-10' : '',
            error ? 'border-error' : 'border-gray-200',
            fullWidth ? 'w-full' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error && inputId ? `${inputId}-error` : undefined}
          {...rest}
        />
      </div>
      {error && (
        <p
          id={inputId ? `${inputId}-error` : undefined}
          className="mt-1 text-xs text-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default Input;
