import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, error, id, className = "", ...props }: InputProps) {
  const inputId = id ?? props.name;
  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={!!error}
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${error ? "border-red-500" : "border-gray-300"} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
