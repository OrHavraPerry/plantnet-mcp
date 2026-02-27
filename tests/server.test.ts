import { createPlantNetServer } from '../src/server';

describe('createPlantNetServer', () => {
  const savedKey = process.env.PLANTNET_API_KEY;
  const savedKeyAlt = process.env.PLANTNET_API;

  afterEach(() => {
    savedKey !== undefined
      ? (process.env.PLANTNET_API_KEY = savedKey)
      : delete process.env.PLANTNET_API_KEY;
    savedKeyAlt !== undefined
      ? (process.env.PLANTNET_API = savedKeyAlt)
      : delete process.env.PLANTNET_API;
  });

  it('throws if neither PLANTNET_API_KEY nor PLANTNET_API is set', () => {
    delete process.env.PLANTNET_API_KEY;
    delete process.env.PLANTNET_API;
    expect(() => createPlantNetServer()).toThrow('PLANTNET_API_KEY');
  });

  it('creates a server when PLANTNET_API_KEY is set', () => {
    process.env.PLANTNET_API_KEY = 'test-key';
    const server = createPlantNetServer();
    expect(server).toBeDefined();
  });

  it('creates a server when only PLANTNET_API is set (fallback)', () => {
    delete process.env.PLANTNET_API_KEY;
    process.env.PLANTNET_API = 'fallback-key';
    const server = createPlantNetServer();
    expect(server).toBeDefined();
  });
});
