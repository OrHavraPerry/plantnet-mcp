import { PlantNetClient } from '../src/plantnet-client';

const FAKE_KEY = 'test-api-key';

// Mock native fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;

const MOCK_IDENTIFY_RESPONSE = {
  query: {
    project: 'all',
    images: ['img1'],
    organs: ['leaf'],
    includeRelatedImages: false,
  },
  language: 'en',
  preferedReferential: 'all',
  bestMatch: 'Quercus robur L.',
  results: [
    {
      score: 0.92,
      species: {
        scientificNameWithoutAuthor: 'Quercus robur',
        scientificNameAuthorship: 'L.',
        scientificName: 'Quercus robur L.',
        genus: { scientificNameWithoutAuthor: 'Quercus' },
        family: { scientificNameWithoutAuthor: 'Fagaceae' },
        commonNames: ['English oak', 'pedunculate oak'],
      },
      gbif: { id: '2878688' },
      powo: { id: '490509-1' },
    },
  ],
  remainingIdentificationRequests: 450,
  version: '2.1',
};

function makeFetchResponse(body: unknown, ok = true, status = 200, contentType = 'image/jpeg') {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    headers: { get: (h: string) => (h === 'content-type' ? contentType : null) },
    arrayBuffer: async () => Buffer.from('fake-image-data').buffer,
    json: async () => body,
  } as unknown as Response;
}

describe('PlantNetClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('throws if no API key is provided', () => {
      expect(() => new PlantNetClient('')).toThrow('PLANTNET_API_KEY is required');
    });

    it('constructs with a valid API key', () => {
      const client = new PlantNetClient(FAKE_KEY);
      expect(client).toBeDefined();
    });
  });

  describe('identifyPlant validation', () => {
    it('throws if image_urls is empty', async () => {
      const client = new PlantNetClient(FAKE_KEY);
      await expect(
        client.identifyPlant({ image_urls: [], organs: [] })
      ).rejects.toThrow('At least one image URL is required');
    });

    it('throws if image_urls and organs lengths differ', async () => {
      const client = new PlantNetClient(FAKE_KEY);
      await expect(
        client.identifyPlant({
          image_urls: ['http://example.com/img.jpg'],
          organs: [],
        })
      ).rejects.toThrow('Number of image_urls must match number of organs');
    });

    it('throws if more than 5 images provided', async () => {
      const client = new PlantNetClient(FAKE_KEY);
      const urls = Array(6).fill('http://example.com/img.jpg');
      const organs = Array(6).fill('leaf');
      await expect(
        client.identifyPlant({ image_urls: urls, organs })
      ).rejects.toThrow('Maximum 5 images');
    });
  });

  describe('identifyPlant API calls', () => {
    it('successfully identifies a plant', async () => {
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(null)) // image fetch
        .mockResolvedValueOnce(makeFetchResponse(MOCK_IDENTIFY_RESPONSE)); // API call

      const client = new PlantNetClient(FAKE_KEY);
      const result = await client.identifyPlant({
        image_urls: ['http://example.com/oak.jpg'],
        organs: ['leaf'],
      });

      expect(result.bestMatch).toBe('Quercus robur L.');
      expect(result.results[0].score).toBe(0.92);
      expect(result.remainingIdentificationRequests).toBe(450);
    });

    it('uses correct API URL with query parameters', async () => {
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(null))
        .mockResolvedValueOnce(makeFetchResponse(MOCK_IDENTIFY_RESPONSE));

      const client = new PlantNetClient(FAKE_KEY);
      await client.identifyPlant({
        image_urls: ['http://example.com/oak.jpg'],
        organs: ['leaf'],
        project: 'weurope',
        lang: 'fr',
        nb_results: 3,
      });

      const apiCall = mockFetch.mock.calls[1];
      const calledUrl = apiCall[0] as string;
      expect(calledUrl).toContain('/v2/identify/weurope');
      expect(calledUrl).toContain('lang=fr');
      expect(calledUrl).toContain('nb-results=3');
      expect(calledUrl).toContain(`api-key=${FAKE_KEY}`);
    });

    it('defaults to project=all, lang=en, nb_results=5', async () => {
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(null))
        .mockResolvedValueOnce(makeFetchResponse(MOCK_IDENTIFY_RESPONSE));

      const client = new PlantNetClient(FAKE_KEY);
      await client.identifyPlant({
        image_urls: ['http://example.com/oak.jpg'],
        organs: ['leaf'],
      });

      const calledUrl = mockFetch.mock.calls[1][0] as string;
      expect(calledUrl).toContain('/v2/identify/all');
      expect(calledUrl).toContain('lang=en');
      expect(calledUrl).toContain('nb-results=5');
    });

    it('throws on failed image fetch', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse(null, false, 404));

      const client = new PlantNetClient(FAKE_KEY);
      await expect(
        client.identifyPlant({
          image_urls: ['http://example.com/missing.jpg'],
          organs: ['leaf'],
        })
      ).rejects.toThrow('Failed to fetch image');
    });

    it('throws on PlantNet API error response', async () => {
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(null))
        .mockResolvedValueOnce(makeFetchResponse({ message: 'Unauthorized' }, false, 401));

      const client = new PlantNetClient(FAKE_KEY);
      await expect(
        client.identifyPlant({
          image_urls: ['http://example.com/oak.jpg'],
          organs: ['leaf'],
        })
      ).rejects.toThrow('PlantNet API error 401');
    });

    it('handles PNG images correctly', async () => {
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(null, true, 200, 'image/png'))
        .mockResolvedValueOnce(makeFetchResponse(MOCK_IDENTIFY_RESPONSE));

      const client = new PlantNetClient(FAKE_KEY);
      const result = await client.identifyPlant({
        image_urls: ['http://example.com/plant.png'],
        organs: ['flower'],
      });

      expect(result.bestMatch).toBe('Quercus robur L.');
      // Verify form data was sent (POST call was made)
      expect(mockFetch.mock.calls[1][1]?.method).toBe('POST');
    });
  });

  describe('listProjects', () => {
    it('fetches available projects', async () => {
      const mockProjects = {
        all: { id: 'all', name: 'World Flora' },
        weurope: { id: 'weurope', name: 'Western Europe' },
      };
      mockFetch.mockResolvedValueOnce(makeFetchResponse(mockProjects));

      const client = new PlantNetClient(FAKE_KEY);
      const result = await client.listProjects();

      expect(result).toEqual(mockProjects);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/v2/projects');
      expect(calledUrl).toContain('lang=en');
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse(null, false, 403));

      const client = new PlantNetClient(FAKE_KEY);
      await expect(client.listProjects()).rejects.toThrow('PlantNet API error 403');
    });
  });
});
