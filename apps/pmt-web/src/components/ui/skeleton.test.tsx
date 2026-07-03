import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('renders a div element', () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('skeleton').tagName).toBe('DIV');
  });

  it('applies animate-pulse class', () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId('skeleton')).toHaveClass('animate-pulse');
  });

  it('applies rounded-md class', () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId('skeleton')).toHaveClass('rounded-md');
  });

  it('applies bg-muted class', () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId('skeleton')).toHaveClass('bg-muted');
  });

  it('applies custom className', () => {
    render(<Skeleton className="w-full h-10" data-testid="skeleton" />);
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveClass('w-full');
    expect(skeleton).toHaveClass('h-10');
  });

  it('passes through additional props', () => {
    render(<Skeleton aria-label="Loading" data-testid="skeleton" />);
    expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-label', 'Loading');
  });

  it('can render with custom height and width via className', () => {
    render(<Skeleton className="h-4 w-[250px]" data-testid="skeleton" />);
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveClass('h-4');
    expect(skeleton).toHaveClass('w-[250px]');
  });

  it('can render multiple skeletons', () => {
    render(
      <div data-testid="container">
        <Skeleton className="h-4 w-full" data-testid="skeleton-1" />
        <Skeleton className="h-4 w-3/4" data-testid="skeleton-2" />
        <Skeleton className="h-4 w-1/2" data-testid="skeleton-3" />
      </div>
    );

    expect(screen.getByTestId('skeleton-1')).toBeInTheDocument();
    expect(screen.getByTestId('skeleton-2')).toBeInTheDocument();
    expect(screen.getByTestId('skeleton-3')).toBeInTheDocument();
  });

  it('renders as circle when rounded-full is applied', () => {
    render(<Skeleton className="h-12 w-12 rounded-full" data-testid="skeleton" />);
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveClass('rounded-full');
    expect(skeleton).toHaveClass('h-12');
    expect(skeleton).toHaveClass('w-12');
  });

  it('merges default and custom classes', () => {
    render(<Skeleton className="custom-class" data-testid="skeleton" />);
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveClass('animate-pulse');
    expect(skeleton).toHaveClass('bg-muted');
    expect(skeleton).toHaveClass('custom-class');
  });
});
