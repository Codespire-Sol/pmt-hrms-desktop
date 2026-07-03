import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders children correctly', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    render(<Badge data-testid="badge">Default</Badge>);
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveClass('bg-primary');
    expect(badge).toHaveClass('text-primary-foreground');
  });

  it('applies secondary variant styles', () => {
    render(<Badge variant="secondary" data-testid="badge">Secondary</Badge>);
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveClass('bg-secondary');
    expect(badge).toHaveClass('text-secondary-foreground');
  });

  it('applies destructive variant styles', () => {
    render(<Badge variant="destructive" data-testid="badge">Destructive</Badge>);
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveClass('bg-destructive');
    expect(badge).toHaveClass('text-destructive-foreground');
  });

  it('applies outline variant styles', () => {
    render(<Badge variant="outline" data-testid="badge">Outline</Badge>);
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveClass('text-foreground');
  });

  it('applies custom className', () => {
    render(<Badge className="custom-class" data-testid="badge">Custom</Badge>);
    expect(screen.getByTestId('badge')).toHaveClass('custom-class');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<Badge ref={ref} data-testid="badge">Ref Badge</Badge>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('renders with inline-flex display', () => {
    render(<Badge data-testid="badge">Flex Badge</Badge>);
    expect(screen.getByTestId('badge')).toHaveClass('inline-flex');
  });

  it('renders with rounded-full styling', () => {
    render(<Badge data-testid="badge">Rounded</Badge>);
    expect(screen.getByTestId('badge')).toHaveClass('rounded-full');
  });

  it('passes through additional props', () => {
    render(<Badge data-testid="badge" aria-label="Status badge">Status</Badge>);
    expect(screen.getByTestId('badge')).toHaveAttribute('aria-label', 'Status badge');
  });

  it('handles onClick when provided', () => {
    const handleClick = vi.fn();
    render(<Badge onClick={handleClick} data-testid="badge">Clickable</Badge>);
    screen.getByTestId('badge').click();
    expect(handleClick).toHaveBeenCalled();
  });
});
