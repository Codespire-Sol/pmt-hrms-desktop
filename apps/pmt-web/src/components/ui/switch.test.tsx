import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from './switch';

describe('Switch', () => {
  it('renders a switch element', () => {
    render(<Switch data-testid="switch" />);
    expect(screen.getByTestId('switch')).toBeInTheDocument();
  });

  it('renders unchecked by default', () => {
    render(<Switch data-testid="switch" />);
    expect(screen.getByTestId('switch')).toHaveAttribute('data-state', 'unchecked');
  });

  it('renders checked when defaultChecked is true', () => {
    render(<Switch defaultChecked data-testid="switch" />);
    expect(screen.getByTestId('switch')).toHaveAttribute('data-state', 'checked');
  });

  it('handles checked state control', () => {
    render(<Switch checked={true} data-testid="switch" />);
    expect(screen.getByTestId('switch')).toHaveAttribute('data-state', 'checked');
  });

  it('handles unchecked state control', () => {
    render(<Switch checked={false} data-testid="switch" />);
    expect(screen.getByTestId('switch')).toHaveAttribute('data-state', 'unchecked');
  });

  it('handles onCheckedChange callback', () => {
    const handleChange = vi.fn();
    render(<Switch onCheckedChange={handleChange} data-testid="switch" />);

    fireEvent.click(screen.getByTestId('switch'));
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('toggles checked state', () => {
    const handleChange = vi.fn();
    const { rerender } = render(
      <Switch checked={false} onCheckedChange={handleChange} data-testid="switch" />
    );

    fireEvent.click(screen.getByTestId('switch'));
    expect(handleChange).toHaveBeenCalledWith(true);

    rerender(<Switch checked={true} onCheckedChange={handleChange} data-testid="switch" />);
    expect(screen.getByTestId('switch')).toHaveAttribute('data-state', 'checked');
  });

  it('handles disabled state', () => {
    render(<Switch disabled data-testid="switch" />);
    expect(screen.getByTestId('switch')).toBeDisabled();
  });

  it('applies custom className', () => {
    render(<Switch className="custom-switch" data-testid="switch" />);
    expect(screen.getByTestId('switch')).toHaveClass('custom-switch');
  });

  it('applies inline-flex class', () => {
    render(<Switch data-testid="switch" />);
    expect(screen.getByTestId('switch')).toHaveClass('inline-flex');
  });

  it('applies h-6 w-11 size classes', () => {
    render(<Switch data-testid="switch" />);
    const switchEl = screen.getByTestId('switch');
    expect(switchEl).toHaveClass('h-6');
    expect(switchEl).toHaveClass('w-11');
  });

  it('applies rounded-full class', () => {
    render(<Switch data-testid="switch" />);
    expect(screen.getByTestId('switch')).toHaveClass('rounded-full');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<Switch ref={ref} data-testid="switch" />);
    expect(ref.current).not.toBeNull();
  });

  it('passes through aria-label', () => {
    render(<Switch aria-label="Enable notifications" data-testid="switch" />);
    expect(screen.getByTestId('switch')).toHaveAttribute('aria-label', 'Enable notifications');
  });

  it('does not fire onChange when disabled', () => {
    const handleChange = vi.fn();
    render(<Switch disabled onCheckedChange={handleChange} data-testid="switch" />);

    fireEvent.click(screen.getByTestId('switch'));
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('has cursor-pointer by default', () => {
    render(<Switch data-testid="switch" />);
    expect(screen.getByTestId('switch')).toHaveClass('cursor-pointer');
  });

  it('renders with name prop', () => {
    render(<Switch name="notifications" data-testid="switch" />);
    expect(screen.getByTestId('switch')).toBeInTheDocument();
  });

  it('renders with required prop', () => {
    render(<Switch required data-testid="switch" />);
    expect(screen.getByTestId('switch')).toBeInTheDocument();
  });
});
