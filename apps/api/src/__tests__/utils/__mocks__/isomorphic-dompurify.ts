// Mock for isomorphic-dompurify
const DOMPurify = {
  sanitize: jest.fn((html: string) => html),
};

export default DOMPurify;
