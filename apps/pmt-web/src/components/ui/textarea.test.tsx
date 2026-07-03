import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from './textarea';

describe('Textarea', () => {
  it('renders a textarea element', () => {
    render(<Textarea data-testid="textarea" />);
    expect(screen.getByTestId('textarea')).toBeInTheDocument();
    expect(screen.getByTestId('textarea').tagName).toBe('TEXTAREA');
  });

  it('applies custom className', () => {
    render(<Textarea className="custom-class" data-testid="textarea" />);
    expect(screen.getByTestId('textarea')).toHaveClass('custom-class');
  });

  it('handles placeholder attribute', () => {
    render(<Textarea placeholder="Enter description" data-testid="textarea" />);
    expect(screen.getByPlaceholderText('Enter description')).toBeInTheDocument();
  });

  it('handles value and onChange', () => {
    const handleChange = vi.fn();
    render(<Textarea value="test content" onChange={handleChange} data-testid="textarea" />);

    const textarea = screen.getByTestId('textarea');
    expect(textarea).toHaveValue('test content');

    fireEvent.change(textarea, { target: { value: 'new content' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('handles disabled state', () => {
    render(<Textarea disabled data-testid="textarea" />);
    expect(screen.getByTestId('textarea')).toBeDisabled();
  });

  it('handles required attribute', () => {
    render(<Textarea required data-testid="textarea" />);
    expect(screen.getByTestId('textarea')).toBeRequired();
  });

  it('handles rows attribute', () => {
    render(<Textarea rows={5} data-testid="textarea" />);
    expect(screen.getByTestId('textarea')).toHaveAttribute('rows', '5');
  });

  it('handles maxLength attribute', () => {
    render(<Textarea maxLength={500} data-testid="textarea" />);
    expect(screen.getByTestId('textarea')).toHaveAttribute('maxLength', '500');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<Textarea ref={ref} data-testid="textarea" />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('applies min-h class for minimum height', () => {
    render(<Textarea data-testid="textarea" />);
    expect(screen.getByTestId('textarea')).toHaveClass('min-h-[80px]');
  });

  it('applies w-full for full width', () => {
    render(<Textarea data-testid="textarea" />);
    expect(screen.getByTestId('textarea')).toHaveClass('w-full');
  });

  it('handles onFocus event', () => {
    const handleFocus = vi.fn();
    render(<Textarea onFocus={handleFocus} data-testid="textarea" />);

    fireEvent.focus(screen.getByTestId('textarea'));
    expect(handleFocus).toHaveBeenCalled();
  });

  it('handles onBlur event', () => {
    const handleBlur = vi.fn();
    render(<Textarea onBlur={handleBlur} data-testid="textarea" />);

    fireEvent.blur(screen.getByTestId('textarea'));
    expect(handleBlur).toHaveBeenCalled();
  });

  it('handles readOnly attribute', () => {
    render(<Textarea readOnly data-testid="textarea" />);
    expect(screen.getByTestId('textarea')).toHaveAttribute('readonly');
  });

  it('passes through aria-label', () => {
    render(<Textarea aria-label="Description" data-testid="textarea" />);
    expect(screen.getByTestId('textarea')).toHaveAttribute('aria-label', 'Description');
  });
});
