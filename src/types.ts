// Types for Pl@ntNet API responses and MCP tool arguments

export interface PlantNetSpecies {
  scientificNameWithoutAuthor: string;
  scientificNameAuthorship: string;
  scientificName: string;
  genus: { scientificNameWithoutAuthor: string };
  family: { scientificNameWithoutAuthor: string };
  commonNames: string[];
}

export interface PlantNetResult {
  score: number;
  species: PlantNetSpecies;
  gbif?: { id: string };
  powo?: { id: string };
}

export interface PlantNetIdentifyResponse {
  query: {
    project: string;
    images: string[];
    organs: string[];
    includeRelatedImages: boolean;
  };
  language: string;
  preferedReferential: string;
  bestMatch: string;
  results: PlantNetResult[];
  remainingIdentificationRequests: number;
  version: string;
}

export interface IdentifyPlantArgs {
  image_urls: string[];
  organs: string[];
  project?: string;
  lang?: string;
  nb_results?: number;
}
