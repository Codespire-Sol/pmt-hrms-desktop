// Mock jwks-rsa to avoid ESM jose import in test environment
const mockClient = {
  getSigningKey: jest.fn().mockResolvedValue({
    getPublicKey: () => 'mock-public-key',
  }),
};

const jwksClient = jest.fn(() => mockClient);

export default jwksClient;
export { jwksClient };
