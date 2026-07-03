import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert, AlertTitle, AlertDescription } from './alert';

describe('Alert', () => {
  it('renders children correctly', () => {
    render(<Alert>Alert content</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Alert content')).toBeInTheDocument();
  });

  it('has alert role', () => {
    render(<Alert>Test</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    render(<Alert data-testid="alert">Default</Alert>);
    const alert = screen.getByTestId('alert');
    expect(alert).toHaveClass('bg-background');
    expect(alert).toHaveClass('text-foreground');
  });

  it('applies destructive variant styles', () => {
    render(<Alert variant="destructive" data-testid="alert">Error</Alert>);
    const alert = screen.getByTestId('alert');
    expect(alert).toHaveClass('text-destructive');
  });

  it('applies success variant styles', () => {
    render(<Alert variant="success" data-testid="alert">Success</Alert>);
    const alert = screen.getByTestId('alert');
    expect(alert).toHaveClass('bg-green-50');
    expect(alert).toHaveClass('text-green-900');
  });

  it('applies custom className', () => {
    render(<Alert className="custom-alert" data-testid="alert">Custom</Alert>);
    expect(screen.getByTestId('alert')).toHaveClass('custom-alert');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<Alert ref={ref}>Ref Alert</Alert>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('renders with rounded and padding', () => {
    render(<Alert data-testid="alert">Styled</Alert>);
    const alert = screen.getByTestId('alert');
    expect(alert).toHaveClass('rounded-lg');
    expect(alert).toHaveClass('p-4');
  });
});

describe('AlertTitle', () => {
  it('renders title text', () => {
    render(<AlertTitle>Alert Title</AlertTitle>);
    expect(screen.getByText('Alert Title')).toBeInTheDocument();
  });

  it('applies font-medium class', () => {
    render(<AlertTitle data-testid="title">Title</AlertTitle>);
    expect(screen.getByTestId('title')).toHaveClass('font-medium');
  });

  it('applies custom className', () => {
    render(<AlertTitle className="custom-title" data-testid="title">Title</AlertTitle>);
    expect(screen.getByTestId('title')).toHaveClass('custom-title');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<AlertTitle ref={ref}>Title</AlertTitle>);
    expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
  });

  it('renders as h5 element', () => {
    render(<AlertTitle data-testid="title">Title</AlertTitle>);
    expect(screen.getByTestId('title').tagName).toBe('H5');
  });
});

describe('AlertDescription', () => {
  it('renders description text', () => {
    render(<AlertDescription>Description text</AlertDescription>);
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('applies text-sm class', () => {
    render(<AlertDescription data-testid="desc">Description</AlertDescription>);
    expect(screen.getByTestId('desc')).toHaveClass('text-sm');
  });

  it('applies custom className', () => {
    render(<AlertDescription className="custom-desc" data-testid="desc">Desc</AlertDescription>);
    expect(screen.getByTestId('desc')).toHaveClass('custom-desc');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<AlertDescription ref={ref}>Description</AlertDescription>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('Alert composition', () => {
  it('renders full alert with title and description', () => {
    render(
      <Alert>
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>This is a warning message.</AlertDescription>
      </Alert>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('This is a warning message.')).toBeInTheDocument();
  });

  it('renders destructive alert with content', () => {
    render(
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Something went wrong.</AlertDescription>
      </Alert>
    );

    expect(screen.getByRole('alert')).toHaveClass('text-destructive');
    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});
