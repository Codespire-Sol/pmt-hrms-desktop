import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from './label';

describe('Label', () => {
  it('renders a label element', () => {
    render(<Label data-testid="label">Test Label</Label>);
    expect(screen.getByTestId('label')).toBeInTheDocument();
    expect(screen.getByTestId('label').tagName).toBe('LABEL');
  });

  it('renders children correctly', () => {
    render(<Label>Username</Label>);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Label className="custom-label" data-testid="label">Label</Label>);
    expect(screen.getByTestId('label')).toHaveClass('custom-label');
  });

  it('applies text-sm class', () => {
    render(<Label data-testid="label">Label</Label>);
    expect(screen.getByTestId('label')).toHaveClass('text-sm');
  });

  it('applies font-medium class', () => {
    render(<Label data-testid="label">Label</Label>);
    expect(screen.getByTestId('label')).toHaveClass('font-medium');
  });

  it('handles htmlFor attribute', () => {
    render(<Label htmlFor="username" data-testid="label">Username</Label>);
    expect(screen.getByTestId('label')).toHaveAttribute('for', 'username');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<Label ref={ref} data-testid="label">Label</Label>);
    expect(ref.current).toBeInstanceOf(HTMLLabelElement);
  });

  it('passes through additional props', () => {
    render(<Label aria-describedby="help-text" data-testid="label">Label</Label>);
    expect(screen.getByTestId('label')).toHaveAttribute('aria-describedby', 'help-text');
  });

  it('renders with input correctly', () => {
    render(
      <div>
        <Label htmlFor="test-input" data-testid="label">Name</Label>
        <input id="test-input" data-testid="input" />
      </div>
    );

    expect(screen.getByTestId('label')).toHaveAttribute('for', 'test-input');
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('merges default and custom classes', () => {
    render(<Label className="my-custom-class" data-testid="label">Label</Label>);
    const label = screen.getByTestId('label');
    expect(label).toHaveClass('text-sm');
    expect(label).toHaveClass('font-medium');
    expect(label).toHaveClass('my-custom-class');
  });
});
