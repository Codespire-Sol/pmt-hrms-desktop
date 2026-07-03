export {};

// Increase timeout for database operations
jest.setTimeout(30000);

// Clean up database connections after all tests (only if prisma was loaded)
afterAll(async () => {
  try {
    const { prisma } = await import('../database/prisma');
    await prisma.$disconnect();
  } catch {
    // Prisma not available (e.g., no database in CI) — skip
  }
});

// Global test utilities
expect.extend({
  toBeUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      pass,
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
    };
  },
  toBeISODate(received: string) {
    const date = new Date(received);
    const pass = !isNaN(date.getTime()) && received === date.toISOString();
    return {
      pass,
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid ISO date string`,
    };
  },
});

// Extend Jest matchers type
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeUUID(): R;
      toBeISODate(): R;
    }
  }
}

// Suppress console.log/error during tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}
