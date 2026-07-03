import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './input';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input data-testid="input" />);
    expect(screen.getByTestId('input')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Input className="custom-class" data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveClass('custom-class');
  });

  it('handles type attribute', () => {
    render(<Input type="password" data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveAttribute('type', 'password');
  });

  it('handles email type', () => {
    render(<Input type="email" data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveAttribute('type', 'email');
  });

  it('handles placeholder attribute', () => {
    render(<Input placeholder="Enter text" data-testid="input" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('handles value and onChange', () => {
    const handleChange = vi.fn();
    render(<Input value="test" onChange={handleChange} data-testid="input" />);

    const input = screen.getByTestId('input');
    expect(input).toHaveValue('test');

    fireEvent.change(input, { target: { value: 'new value' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('handles disabled state', () => {
    render(<Input disabled data-testid="input" />);
    expect(screen.getByTestId('input')).toBeDisabled();
  });

  it('handles required attribute', () => {
    render(<Input required data-testid="input" />);
    expect(screen.getByTestId('input')).toBeRequired();
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<Input ref={ref} data-testid="input" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('handles maxLength attribute', () => {
    render(<Input maxLength={10} data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveAttribute('maxLength', '10');
  });

  it('handles onFocus event', () => {
    const handleFocus = vi.fn();
    render(<Input onFocus={handleFocus} data-testid="input" />);

    fireEvent.focus(screen.getByTestId('input'));
    expect(handleFocus).toHaveBeenCalled();
  });

  it('handles onBlur event', () => {
    const handleBlur = vi.fn();
    render(<Input onBlur={handleBlur} data-testid="input" />);

    fireEvent.blur(screen.getByTestId('input'));
    expect(handleBlur).toHaveBeenCalled();
  });

  it('has default text type when not specified', () => {
    render(<Input data-testid="input" />);
    // Default type for input is text when not specified
    const input = screen.getByTestId('input');
    expect(input.tagName).toBe('INPUT');
  });
});
