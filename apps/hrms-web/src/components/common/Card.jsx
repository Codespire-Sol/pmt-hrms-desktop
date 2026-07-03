export default function Card({
  children,
  title,
  className = '',
  onClick,
  ...props
}) {
  const isClickable = !!onClick;

  return (
    <div
      className={`card ${isClickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}
      onClick={onClick}
      {...props}
    >
      {title && (
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
