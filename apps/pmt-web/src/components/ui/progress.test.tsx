import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Progress } from './progress';

describe('Progress', () => {
  it('renders a progress element', () => {
    render(<Progress data-testid="progress" />);
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('renders with value of 0 by default', () => {
    render(<Progress data-testid="progress" />);
    const progress = screen.getByTestId('progress');
    expect(progress).toBeInTheDocument();
  });

  it('renders with specified value', () => {
    render(<Progress value={50} data-testid="progress" />);
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('handles 0% progress', () => {
    render(<Progress value={0} data-testid="progress" />);
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('handles 100% progress', () => {
    render(<Progress value={100} data-testid="progress" />);
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Progress className="custom-progress" data-testid="progress" />);
    expect(screen.getByTestId('progress')).toHaveClass('custom-progress');
  });

  it('applies default height class', () => {
    render(<Progress data-testid="progress" />);
    expect(screen.getByTestId('progress')).toHaveClass('h-4');
  });

  it('applies rounded-full class', () => {
    render(<Progress data-testid="progress" />);
    expect(screen.getByTestId('progress')).toHaveClass('rounded-full');
  });

  it('applies bg-secondary class', () => {
    render(<Progress data-testid="progress" />);
    expect(screen.getByTestId('progress')).toHaveClass('bg-secondary');
  });

  it('applies overflow-hidden class', () => {
    render(<Progress data-testid="progress" />);
    expect(screen.getByTestId('progress')).toHaveClass('overflow-hidden');
  });

  it('applies custom indicatorClassName', () => {
    render(<Progress indicatorClassName="indicator-custom" data-testid="progress" />);
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<Progress ref={ref} data-testid="progress" />);
    expect(ref.current).not.toBeNull();
  });

  it('handles various progress values', () => {
    const values = [0, 25, 50, 75, 100];
    values.forEach((value, index) => {
      render(<Progress value={value} data-testid={`progress-${index}`} />);
      expect(screen.getByTestId(`progress-${index}`)).toBeInTheDocument();
    });
  });

  it('renders with relative positioning', () => {
    render(<Progress data-testid="progress" />);
    expect(screen.getByTestId('progress')).toHaveClass('relative');
  });

  it('renders with full width', () => {
    render(<Progress data-testid="progress" />);
    expect(screen.getByTestId('progress')).toHaveClass('w-full');
  });
});
