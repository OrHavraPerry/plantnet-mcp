/**
 * Live integration test — calls the real PlantNet API with a local image file.
 * Usage: PLANTNET_API_KEY=your_key npx ts-node test-live.ts <image-path> [organ]
 * Organ defaults to "auto". Options: leaf, flower, fruit, bark, habit, other
 *
 * Example:
 *   PLANTNET_API_KEY=abc123 npx ts-node test-live.ts C:/Users/me/plant.jpg fruit
 */

import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';

async function main() {
  const apiKey = process.env.PLANTNET_API_KEY;
  if (!apiKey) {
    console.error('Error: PLANTNET_API_KEY environment variable is required.');
    console.error('Usage: PLANTNET_API_KEY=your_key npx ts-node test-live.ts <image-path> [organ]');
    process.exit(1);
  }

  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error('Error: image path is required.');
    console.error('Usage: PLANTNET_API_KEY=your_key npx ts-node test-live.ts <image-path> [organ]');
    process.exit(1);
  }

  const organ = process.argv[3] || 'auto';
  const resolvedPath = path.resolve(imagePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: file not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`\nIdentifying plant from: ${resolvedPath}`);
  console.log(`Organ: ${organ}`);
  console.log('Calling Pl@ntNet API...\n');

  const imageBuffer = fs.readFileSync(resolvedPath);
  const ext = path.extname(resolvedPath).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

  const form = new FormData();
  form.append('images', imageBuffer, { filename: path.basename(resolvedPath), contentType });
  form.append('organs', organ);

  const url = new URL('/v2/identify/all', 'https://my-api.plantnet.org');
  url.searchParams.set('api-key', apiKey);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('nb-results', '5');
  url.searchParams.set('include-related-images', 'false');

  const response = await fetch(url.toString(), {
    method: 'POST',
    body: form.getBuffer() as unknown as BodyInit,
    headers: form.getHeaders() as Record<string, string>,
  });

  const data = await response.json() as any;

  if (!response.ok) {
    console.error(`API Error ${response.status}:`, JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log(`Best match: ${data.bestMatch}`);
  console.log(`Remaining daily quota: ${data.remainingIdentificationRequests}`);
  console.log('='.repeat(60));

  data.results.forEach((r: any, i: number) => {
    const confidence = (r.score * 100).toFixed(1);
    const common = r.species.commonNames.slice(0, 3).join(', ') || 'none known';
    console.log(`\n#${i + 1} ${r.species.scientificNameWithoutAuthor} (${confidence}%)`);
    console.log(`     Author   : ${r.species.scientificNameAuthorship || 'unknown'}`);
    console.log(`     Family   : ${r.species.family.scientificNameWithoutAuthor}`);
    console.log(`     Genus    : ${r.species.genus.scientificNameWithoutAuthor}`);
    console.log(`     Common   : ${common}`);
    if (r.gbif) console.log(`     GBIF ID  : ${r.gbif.id}`);
    if (r.powo) console.log(`     POWO ID  : ${r.powo.id}`);
  });

  console.log('\n' + '='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
