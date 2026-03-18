export function PageTitle({
  title,
  description,
  className = "",
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <h1 className="text-xl font-semibold text-neutral-800">{title}</h1>
      {description && (
        <p className="text-neutral-600 mt-2">{description}</p>
      )}
    </div>
  );
}
