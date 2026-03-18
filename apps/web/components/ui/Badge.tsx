type BadgeVariant = "success" | "warning" | "error";

const variantClasses: Record<BadgeVariant, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
};

export function Badge({
  variant,
  children,
  className = "",
}: {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`${variantClasses[variant]} ${className}`.trim()}>
      {children}
    </span>
  );
}
