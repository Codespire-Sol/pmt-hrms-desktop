import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Badge from '../common/Badge';

describe('Badge Component', () => {
  it('renders badge with text', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('applies success variant classes', () => {
    const { container } = render(<Badge variant="success">Success</Badge>);
    const badge = container.firstChild;
    expect(badge.className).toContain('bg-success-100');
    expect(badge.className).toContain('text-success-700');
  });

  it('applies error variant classes', () => {
    const { container } = render(<Badge variant="error">Error</Badge>);
    const badge = container.firstChild;
    expect(badge.className).toContain('bg-error-100');
  });

  it('applies warning variant classes', () => {
    const { container } = render(<Badge variant="warning">Warning</Badge>);
    const badge = container.firstChild;
    expect(badge.className).toContain('bg-warning-100');
  });

  it('applies info variant classes by default', () => {
    const { container } = render(<Badge>Info</Badge>);
    const badge = container.firstChild;
    expect(badge.className).toContain('bg-primary-100');
  });

  it('applies custom className', () => {
    const { container } = render(<Badge className="custom">Test</Badge>);
    const badge = container.firstChild;
    expect(badge.className).toContain('custom');
  });
});
