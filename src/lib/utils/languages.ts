/**
 * Normalize ISO 639-2 B/T variant codes to a single canonical code.
 * E.g., 'fre' (bibliographic) → 'fra' (terminology).
 */
const CODE_ALIASES: Record<string, string> = {
	fre: 'fra', // French: bibliographic → terminology
	ger: 'deu' // German: bibliographic → terminology (if needed later)
};

/**
 * Normalize a language code to its canonical form.
 */
export function normalizeLanguageCode(code: string): string {
	const lower = code.toLowerCase();
	return CODE_ALIASES[lower] ?? lower;
}

/**
 * ISO 639-2/B and ISO 639-3 language code to English name mapping.
 * Only includes codes found in the dataset.
 */
const languageNames: Record<string, string> = {
	ach: 'Acholi',
	ara: 'Arabic',
	cat: 'Catalan',
	deu: 'German',
	dholuo: 'Dholuo',
	eng: 'English',
	ewe: 'Ewe',
	fat: 'Fanti',
	fra: 'French',
	gaa: 'Ga',
	ger: 'German',
	hau: 'Hausa',
	heb: 'Hebrew',
	her: 'Herero',
	ibo: 'Igbo',
	kru: 'Kru',
	lat: 'Latin',
	lug: 'Luganda',
	mas: 'Maasai',
	mon: 'Mongolian',
	pcm: 'Nigerian Pidgin',
	por: 'Portuguese',
	sag: 'Sango',
	samburu: 'Samburu',
	spa: 'Spanish',
	swa: 'Swahili',
	tur: 'Turkish',
	twi: 'Twi',
	yor: 'Yoruba'
};

/**
 * Convert an ISO 639-2/3 code to the full English language name.
 * Normalizes B/T variants first so 'fre' and 'fra' both return 'French'.
 * Returns the code as-is if not found (handles non-standard values like "Dholuo").
 */
export function languageName(code: string): string {
	const normalized = normalizeLanguageCode(code);
	return languageNames[normalized] || code;
}
