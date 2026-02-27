import FormData from 'form-data';
import type { PlantNetIdentifyResponse, IdentifyPlantArgs } from './types';

const BASE_URL = 'https://my-api.plantnet.org';

export class PlantNetClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('PLANTNET_API_KEY is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Identify plant species from one or more image URLs.
   * Downloads each image and sends as multipart form data to the Pl@ntNet API.
   */
  async identifyPlant(args: IdentifyPlantArgs): Promise<PlantNetIdentifyResponse> {
    const {
      image_urls,
      organs,
      project = 'all',
      lang = 'en',
      nb_results = 5,
    } = args;

    if (image_urls.length === 0) {
      throw new Error('At least one image URL is required');
    }
    if (image_urls.length !== organs.length) {
      throw new Error('Number of image_urls must match number of organs');
    }
    if (image_urls.length > 5) {
      throw new Error('Maximum 5 images per request');
    }

    const form = new FormData();

    // Download each image and attach as binary
    for (let i = 0; i < image_urls.length; i++) {
      const imgResponse = await fetch(image_urls[i]);
      if (!imgResponse.ok) {
        throw new Error(
          `Failed to fetch image at ${image_urls[i]}: ${imgResponse.statusText}`
        );
      }
      const buffer = Buffer.from(await imgResponse.arrayBuffer());
      const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : 'jpg';
      form.append('images', buffer, {
        filename: `image${i}.${ext}`,
        contentType,
      });
      form.append('organs', organs[i]);
    }

    const url = new URL(`/v2/identify/${encodeURIComponent(project)}`, BASE_URL);
    url.searchParams.set('api-key', this.apiKey);
    url.searchParams.set('lang', lang);
    url.searchParams.set('nb-results', String(nb_results));
    url.searchParams.set('include-related-images', 'false');

    const response = await fetch(url.toString(), {
      method: 'POST',
      // Buffer extends Uint8Array; cast needed for native fetch types
      body: form.getBuffer() as unknown as BodyInit,
      headers: form.getHeaders() as Record<string, string>,
    });

    const data = (await response.json()) as PlantNetIdentifyResponse;

    if (!response.ok) {
      throw new Error(
        `PlantNet API error ${response.status}: ${JSON.stringify(data)}`
      );
    }

    return data;
  }

  /**
   * Fetch list of available flora projects/referentials.
   */
  async listProjects(
    lang = 'en'
  ): Promise<Record<string, { id: string; name: string }>> {
    const url = new URL('/v2/projects', BASE_URL);
    url.searchParams.set('api-key', this.apiKey);
    url.searchParams.set('lang', lang);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(
        `PlantNet API error ${response.status}: ${response.statusText}`
      );
    }

    return response.json() as Promise<
      Record<string, { id: string; name: string }>
    >;
  }
}
