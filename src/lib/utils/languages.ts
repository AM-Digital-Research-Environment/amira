/**
 * ISO 639-2/B and ISO 639-3 language code to English name mapping.
 * Only includes codes found in the dataset.
 */
const languageNames: Record<string, string> = {
	ach: 'Acholi',
	cat: 'Catalan',
	eng: 'English',
	ewe: 'Ewe',
	fat: 'Fanti',
	fra: 'French',
	fre: 'French',
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
	spa: 'Spanish',
	swa: 'Swahili',
	tur: 'Turkish',
	twi: 'Twi',
	yor: 'Yoruba'
};

/**
 * Convert an ISO 639-2/3 code to the full English language name.
 * Returns the code as-is if not found (handles non-standard values like "Dholuo").
 */
export function languageName(code: string): string {
	return languageNames[code.toLowerCase()] || code;
}
