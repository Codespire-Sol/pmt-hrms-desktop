import { STATUS_COLORS } from '../../utils/constants';

export default function Badge({
  children,
  variant = 'info',
  status,
  className = ''
}) {
  const variantClasses = {
    success: 'bg-success-100 text-success-700',
    warning: 'bg-warning-100 text-warning-700',
    error: 'bg-error-100 text-error-700',
    info: 'bg-primary-100 text-primary-700'
  };

  // If status is provided, use STATUS_COLORS mapping
  const badgeClass = status ? STATUS_COLORS[status] : variantClasses[variant];

  return (
    <span className={`badge ${badgeClass} ${className}`}>
      {children}
    </span>
  );
}
