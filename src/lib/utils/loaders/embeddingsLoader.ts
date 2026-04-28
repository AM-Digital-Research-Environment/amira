import type { SemanticMapData, SimilarItemsData } from '$lib/types';
import { fetchJSON } from './fetchHelpers';

/**
 * Load the semantic-map payload (per-item UMAP coords + metadata snapshots).
 *
 * The file is produced by `scripts/generate_embeddings.py`. Returns null when
 * the file doesn't exist yet so the frontend can render an explanatory empty
 * state instead of throwing on first-time setups.
 */
export async function loadSemanticMap(basePath: string = ''): Promise<SemanticMapData | null> {
	return fetchJSON<SemanticMapData>(`${basePath}/data/embeddings/map.json`);
}

/**
 * Load the pre-computed top-K cosine neighbours per item.
 */
export async function loadSimilarItems(basePath: string = ''): Promise<SimilarItemsData | null> {
	return fetchJSON<SimilarItemsData>(`${basePath}/data/embeddings/similar.json`);
}
