import { type InputHTMLAttributes, forwardRef } from "react";
import { Label } from "./Label";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = "", ...props }, ref) => {
    const inputId = id ?? (label ? label.replace(/\s+/g, "-").toLowerCase() : undefined);
    const inputClasses = [
      "w-full border rounded px-3 py-2",
      error ? "border-error" : "border-neutral-200",
      className,
    ].filter(Boolean).join(" ");

    return (
      <div>
        {label && (
          <Label htmlFor={inputId}>
            {label}
          </Label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={inputClasses}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={inputId ? `${inputId}-error` : undefined} className="text-sm text-error mt-1">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
