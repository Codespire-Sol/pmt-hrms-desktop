# HRMS - Modern Management & Collaboration System

Modern HRMS frontend built with React, Vite, Tailwind CSS, and Zustand.

## Prerequisites

- Node.js >= 18.x
- npm or yarn

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Create `.env` file in the root directory:

```env
VITE_APP_NAME="HRMS"
VITE_API_URL=http://localhost:4000/api/v1
VITE_API_VERSION="v1"
VITE_API_BASE_URL=http://localhost:4000/api/v1
VITE_UPLOADS_BASE_URL=http://localhost:4000

# Auth: 'jwt' renders the local email/password login (no Keycloak)
VITE_AUTH_MODE=jwt
```

### 3. Start Development Server

```bash
npm run dev
```

Application will start on `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Check code style
- `npm run lint:fix` - Fix code style issues
- `npm test` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage report

## Project Structure

```
frontend/
├── public/                  # Static assets
├── src/
│   ├── api/                # API client and services
│   ├── components/         # React components
│   │   ├── common/        # Reusable components (Button, Input, Modal, etc.)
│   │   ├── layout/        # Layout components (Sidebar, Header, etc.)
│   │   └── modules/       # Feature-specific components
│   ├── hooks/             # Custom React hooks
│   ├── pages/             # Page components
│   ├── store/             # Zustand stores
│   ├── styles/            # Global styles
│   ├── utils/             # Utility functions
│   ├── App.jsx            # Root component
│   └── main.jsx           # Entry point
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **React Router v6** - Client-side routing
- **Zustand** - State management
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client
- **React Hook Form** - Form handling
- **Zod** - Schema validation
- **date-fns** - Date utilities
- **Lucide React** - Icon library

## Development Guidelines

### Component Structure

```jsx
// src/components/common/Button.jsx
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  ...props
}) {
  const baseClasses = 'btn';
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost'
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

### API Services

```javascript
// src/api/employees.js
import apiClient from './axios';

export const employeeService = {
  getAll: (params) => apiClient.get('/employees', { params }),
  getById: (id) => apiClient.get(`/employees/${id}`),
  create: (data) => apiClient.post('/employees', data),
  update: (id, data) => apiClient.put(`/employees/${id}`, data),
  delete: (id) => apiClient.delete(`/employees/${id}`)
};
```

### Custom Hooks

```javascript
// src/hooks/useApi.js
import { useState, useEffect } from 'react';

export function useApi(apiFunc, immediate = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = async (...params) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFunc(...params);
      setData(result.data);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, []);

  return { data, loading, error, execute, refetch: execute };
}
```

## Styling Guidelines

### Tailwind CSS Classes

Use Tailwind utility classes for styling:

```jsx
<div className="bg-white rounded-lg shadow-md p-6">
  <h2 className="text-2xl font-semibold text-slate-800 mb-4">
    Title
  </h2>
  <p className="text-slate-600">
    Content
  </p>
</div>
```

### Custom CSS Classes

For repeated patterns, create custom classes in `globals.css`:

```css
@layer components {
  .card {
    @apply bg-white rounded-lg shadow-sm border border-slate-200 p-6;
  }
}
```

## State Management

### Zustand Store

```javascript
// src/store/employeeStore.js
import { create } from 'zustand';

export const useEmployeeStore = create((set) => ({
  employees: [],
  selectedEmployee: null,

  setEmployees: (employees) => set({ employees }),
  selectEmployee: (employee) => set({ selectedEmployee: employee }),
  clearSelection: () => set({ selectedEmployee: null })
}));
```

## Routing

```jsx
// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="employees" element={<Employees />} />
          <Route path="employees/:id" element={<EmployeeDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

## Testing

```javascript
// src/components/__tests__/Button.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../Button';

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

## Build for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

## Environment Variables

Create a `.env` file:

```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

Access in code:

```javascript
const apiUrl = import.meta.env.VITE_API_BASE_URL;
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Run linter and tests
5. Submit pull request

## License

[Elastic License 2.0](../../LICENSE).
