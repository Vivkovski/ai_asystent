export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border border-neutral-200 rounded-lg p-4 ${className}`.trim()}
    >
      {title && (
        <h3 className="text-heading-md text-neutral-800 mb-3">{title}</h3>
      )}
      {children}
    </div>
  );
}
