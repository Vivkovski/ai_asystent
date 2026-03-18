import { type LabelHTMLAttributes } from "react";

export function Label({
  className = "",
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`block text-sm font-medium mb-1 ${className}`.trim()}
      {...props}
    >
      {children}
    </label>
  );
}
