import { PlantNetClient } from '../src/plantnet-client';

const FAKE_KEY = 'test-api-key';

describe('PlantNetClient', () => {
  it('throws if no API key is provided', () => {
    expect(() => new PlantNetClient('')).toThrow('PLANTNET_API_KEY is required');
  });

  it('constructs with a valid API key', () => {
    const client = new PlantNetClient(FAKE_KEY);
    expect(client).toBeDefined();
  });
});
