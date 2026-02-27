import { createPlantNetServer } from '../src/server';

describe('createPlantNetServer', () => {
  const savedKey = process.env.PLANTNET_API_KEY;

  afterEach(() => {
    if (savedKey !== undefined) {
      process.env.PLANTNET_API_KEY = savedKey;
    } else {
      delete process.env.PLANTNET_API_KEY;
    }
  });

  it('throws if PLANTNET_API_KEY is not set', () => {
    delete process.env.PLANTNET_API_KEY;
    expect(() => createPlantNetServer()).toThrow('PLANTNET_API_KEY');
  });

  it('creates a server when API key is set', () => {
    process.env.PLANTNET_API_KEY = 'test-key';
    const server = createPlantNetServer();
    expect(server).toBeDefined();
  });
});
