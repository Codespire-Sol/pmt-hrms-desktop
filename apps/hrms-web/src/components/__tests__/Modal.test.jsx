import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Modal from '../common/Modal';

describe('Modal Component', () => {
  beforeEach(() => {
    // Reset body overflow
    document.body.style.overflow = 'unset';
  });

  it('does not render when isOpen is false', () => {
    render(<Modal isOpen={false} title="Test">Content</Modal>);
    expect(screen.queryByText('Test')).not.toBeInTheDocument();
  });

  it('renders when isOpen is true', () => {
    render(<Modal isOpen={true} title="Test Modal">Modal Content</Modal>);
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const handleClose = vi.fn();
    render(<Modal isOpen={true} onClose={handleClose} title="Test">Content</Modal>);

    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop clicked', () => {
    const handleClose = vi.fn();
    const { container } = render(
      <Modal isOpen={true} onClose={handleClose} title="Test">Content</Modal>
    );

    const backdrop = container.querySelector('.bg-black');
    fireEvent.click(backdrop);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders footer when provided', () => {
    const footer = <button>Action Button</button>;
    render(<Modal isOpen={true} title="Test" footer={footer}>Content</Modal>);

    expect(screen.getByText('Action Button')).toBeInTheDocument();
  });

  it('applies size classes correctly', () => {
    const { container } = render(
      <Modal isOpen={true} size="lg" title="Test">Content</Modal>
    );

    const modal = container.querySelector('.max-w-4xl');
    expect(modal).toBeInTheDocument();
  });

  it('locks body scroll when open', () => {
    render(<Modal isOpen={true} title="Test">Content</Modal>);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('unlocks body scroll when closed', () => {
    const { rerender } = render(<Modal isOpen={true} title="Test">Content</Modal>);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<Modal isOpen={false} title="Test">Content</Modal>);
    expect(document.body.style.overflow).toBe('unset');
  });
});
