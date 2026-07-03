// Mock for marked module
const markedFn: any = jest.fn((text: string) => `<p>${text}</p>`);
markedFn.setOptions = jest.fn();
markedFn.parse = jest.fn((text: string) => `<p>${text}</p>`);

export const marked = markedFn;
export default marked;
