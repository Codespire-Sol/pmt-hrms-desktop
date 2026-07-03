import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Input from '../common/Input';

describe('Input Component', () => {
  it('renders input with label', () => {
    render(<Input label="Test Label" />);
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  it('renders input without label', () => {
    render(<Input placeholder="Test" />);
    const input = screen.getByPlaceholderText('Test');
    expect(input).toBeInTheDocument();
  });

  it('shows error message when error prop provided', () => {
    render(<Input label="Test" error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('applies error styling when error exists', () => {
    render(<Input error="Error" />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('input-error');
  });

  it('handles onChange events', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test value' } });

    expect(handleChange).toHaveBeenCalled();
  });

  it('supports different input types', () => {
    const { container, rerender } = render(<Input type="email" />);
    expect(screen.getByRole('textbox').type).toBe('email');

    rerender(<Input type="password" />);
    const passwordInput = container.querySelector('input[type="password"]');
    expect(passwordInput.type).toBe('password');
  });

  it('passes through additional props', () => {
    render(<Input placeholder="Test" required />);
    const input = screen.getByPlaceholderText('Test');
    expect(input).toBeRequired();
  });
});
