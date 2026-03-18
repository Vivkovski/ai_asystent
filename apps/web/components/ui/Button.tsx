import { type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50",
  secondary:
    "bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50",
  ghost:
    "text-neutral-600 hover:bg-neutral-100 disabled:opacity-50",
  danger:
    "border border-error/50 text-error hover:bg-error-light disabled:opacity-50",
  success:
    "bg-success text-white hover:bg-success/90 disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "text-sm py-1.5 px-3 rounded",
  md: "text-sm font-medium py-2 px-4 rounded",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
