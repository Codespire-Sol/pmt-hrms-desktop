import { Request, Response, NextFunction } from 'express';

// Mock Express request
export const mockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    roleId: 'test-role-id',
  } as any,
  ...overrides,
});

// Mock Express response
export const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

// Mock next function
export const mockNext: NextFunction = jest.fn();

// Mock database query builder
export const mockQueryBuilder = () => {
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereNotIn: jest.fn().mockReturnThis(),
    whereBetween: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    rightJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue([{ count: '0' }]),
    then: jest.fn().mockResolvedValue([]),
  };
  return builder;
};

// Mock Redis client
export const mockRedisClient = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(-1),
  incr: jest.fn().mockResolvedValue(1),
  decr: jest.fn().mockResolvedValue(0),
  hget: jest.fn().mockResolvedValue(null),
  hset: jest.fn().mockResolvedValue(1),
  hdel: jest.fn().mockResolvedValue(1),
  hgetall: jest.fn().mockResolvedValue({}),
  publish: jest.fn().mockResolvedValue(1),
  subscribe: jest.fn().mockResolvedValue('OK'),
  quit: jest.fn().mockResolvedValue('OK'),
});

// Mock WebSocket
export const mockSocket = () => ({
  id: 'test-socket-id',
  data: { user: { id: 'test-user-id' } },
  join: jest.fn(),
  leave: jest.fn(),
  emit: jest.fn(),
  to: jest.fn().mockReturnThis(),
  on: jest.fn(),
  off: jest.fn(),
  disconnect: jest.fn(),
});

// Mock Socket.io server
export const mockIoServer = () => ({
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  in: jest.fn().mockReturnThis(),
  sockets: {
    sockets: new Map(),
  },
});

// Mock web-push
export const mockWebPush = {
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({ statusCode: 201 }),
};

// Mock nodemailer transporter
export const mockEmailTransporter = () => ({
  sendMail: jest.fn().mockResolvedValue({
    messageId: 'test-message-id',
    accepted: ['test@example.com'],
    rejected: [],
  }),
  verify: jest.fn().mockResolvedValue(true),
});

// Mock JWT
export const mockJwt = {
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn().mockReturnValue({ id: 'test-user-id', email: 'test@example.com' }),
  decode: jest.fn().mockReturnValue({ id: 'test-user-id', email: 'test@example.com' }),
};

// Mock bcrypt
export const mockBcrypt = {
  hash: jest.fn().mockResolvedValue('$2b$10$hashed.password'),
  compare: jest.fn().mockResolvedValue(true),
};

// Mock file upload
export interface MockMulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
  stream: any;
}

export const mockMulterFile = (overrides: Partial<MockMulterFile> = {}): MockMulterFile => ({
  fieldname: 'file',
  originalname: 'test-file.pdf',
  encoding: '7bit',
  mimetype: 'application/pdf',
  size: 1024,
  destination: '/tmp',
  filename: 'test-file-123.pdf',
  path: '/tmp/test-file-123.pdf',
  buffer: Buffer.from('test file content'),
  stream: null as any,
  ...overrides,
});
