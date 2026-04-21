// Types for the semantic-map pipeline. Backed by
// `static/data/embeddings/map.json` and `static/data/embeddings/similar.json`,
// produced by `scripts/generate_embeddings.py`.

export interface SemanticMapItem {
	/** `dre_id` (or `_id` fallback) — stable identifier matching CollectionItem. */
	id: string;
	/** UMAP X coordinate (arbitrary units — only relative distances matter). */
	x: number;
	/** UMAP Y coordinate. */
	y: number;
	/** True when the concatenated metadata used for embedding was below the
	 * low-signal threshold (100 chars). Rendered dimmer on the scatter plot
	 * and suppressed from similarity suggestions. */
	lowSignal: boolean;
	/** Length of the concatenated metadata blob fed to Gemini. */
	inputChars: number;
	title: string;
	project: string | null;
	projectName: string | null;
	university: string | null;
	typeOfResource: string | null;
}

export interface SemanticMapUmapParams {
	nNeighbors: number;
	minDist: number;
	metric: string;
	seed: number;
}

export interface SemanticMapData {
	model: string;
	dims: number;
	taskType: string;
	umap: SemanticMapUmapParams;
	lowSignalThreshold: number;
	generatedAt: string;
	items: SemanticMapItem[];
}

export interface SimilarItemRef {
	/** `dre_id` of the neighbour. */
	id: string;
	/** Cosine similarity in [-1, 1] — in practice (0, 1] since vectors
	 * cluster in the positive orthant for text embeddings. */
	score: number;
}

export interface SimilarItemsData {
	model: string;
	dims: number;
	topK: number;
	/** Map from item id to its ranked neighbours (score desc). */
	items: Record<string, SimilarItemRef[]>;
}
