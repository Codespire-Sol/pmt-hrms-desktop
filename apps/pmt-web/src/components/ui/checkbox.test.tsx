import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('renders a checkbox element', () => {
    render(<Checkbox data-testid="checkbox" />);
    expect(screen.getByTestId('checkbox')).toBeInTheDocument();
  });

  it('renders unchecked by default', () => {
    render(<Checkbox data-testid="checkbox" />);
    expect(screen.getByTestId('checkbox')).toHaveAttribute('data-state', 'unchecked');
  });

  it('renders checked when defaultChecked is true', () => {
    render(<Checkbox defaultChecked data-testid="checkbox" />);
    expect(screen.getByTestId('checkbox')).toHaveAttribute('data-state', 'checked');
  });

  it('handles checked state control', () => {
    render(<Checkbox checked={true} data-testid="checkbox" />);
    expect(screen.getByTestId('checkbox')).toHaveAttribute('data-state', 'checked');
  });

  it('handles unchecked state control', () => {
    render(<Checkbox checked={false} data-testid="checkbox" />);
    expect(screen.getByTestId('checkbox')).toHaveAttribute('data-state', 'unchecked');
  });

  it('handles onCheckedChange callback', () => {
    const handleChange = vi.fn();
    render(<Checkbox onCheckedChange={handleChange} data-testid="checkbox" />);

    fireEvent.click(screen.getByTestId('checkbox'));
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('toggles checked state', () => {
    const handleChange = vi.fn();
    const { rerender } = render(
      <Checkbox checked={false} onCheckedChange={handleChange} data-testid="checkbox" />
    );

    fireEvent.click(screen.getByTestId('checkbox'));
    expect(handleChange).toHaveBeenCalledWith(true);

    rerender(<Checkbox checked={true} onCheckedChange={handleChange} data-testid="checkbox" />);
    expect(screen.getByTestId('checkbox')).toHaveAttribute('data-state', 'checked');
  });

  it('handles disabled state', () => {
    render(<Checkbox disabled data-testid="checkbox" />);
    expect(screen.getByTestId('checkbox')).toBeDisabled();
  });

  it('applies custom className', () => {
    render(<Checkbox className="custom-checkbox" data-testid="checkbox" />);
    expect(screen.getByTestId('checkbox')).toHaveClass('custom-checkbox');
  });

  it('applies h-4 w-4 size classes', () => {
    render(<Checkbox data-testid="checkbox" />);
    const checkbox = screen.getByTestId('checkbox');
    expect(checkbox).toHaveClass('h-4');
    expect(checkbox).toHaveClass('w-4');
  });

  it('applies rounded-sm class', () => {
    render(<Checkbox data-testid="checkbox" />);
    expect(screen.getByTestId('checkbox')).toHaveClass('rounded-sm');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<Checkbox ref={ref} data-testid="checkbox" />);
    expect(ref.current).not.toBeNull();
  });

  it('passes through aria-label', () => {
    render(<Checkbox aria-label="Accept terms" data-testid="checkbox" />);
    expect(screen.getByTestId('checkbox')).toHaveAttribute('aria-label', 'Accept terms');
  });

  it('does not fire onChange when disabled', () => {
    const handleChange = vi.fn();
    render(<Checkbox disabled onCheckedChange={handleChange} data-testid="checkbox" />);

    fireEvent.click(screen.getByTestId('checkbox'));
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('renders with required prop', () => {
    render(<Checkbox required data-testid="checkbox" />);
    expect(screen.getByTestId('checkbox')).toBeInTheDocument();
  });

  it('renders with name prop', () => {
    render(<Checkbox name="terms" data-testid="checkbox" />);
    expect(screen.getByTestId('checkbox')).toBeInTheDocument();
  });

  it('renders with value prop', () => {
    render(<Checkbox value="accepted" data-testid="checkbox" />);
    expect(screen.getByTestId('checkbox')).toBeInTheDocument();
  });
});
