import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Card from '../common/Card';

describe('Card Component', () => {
  it('renders children', () => {
    render(<Card>Test Content</Card>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<Card title="Test Title">Content</Card>);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('calls onClick when clicked and onClick provided', () => {
    const handleClick = vi.fn();
    render(<Card onClick={handleClick}>Clickable Card</Card>);

    fireEvent.click(screen.getByText('Clickable Card'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies cursor-pointer class when onClick provided', () => {
    const { container } = render(<Card onClick={() => {}}>Clickable</Card>);
    const card = container.firstChild;
    expect(card.className).toContain('cursor-pointer');
  });

  it('does not apply cursor-pointer when onClick not provided', () => {
    const { container } = render(<Card>Not Clickable</Card>);
    const card = container.firstChild;
    expect(card.className).not.toContain('cursor-pointer');
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    const card = container.firstChild;
    expect(card.className).toContain('custom-class');
  });
});
