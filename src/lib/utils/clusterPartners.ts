import { base } from '$app/paths';
import { CHART_COLORS } from '$lib/styles';
import { institutionUrl } from './urls';

/** Toggleable category — shared between data, legend, and visibility filter. */
export type PartnerCategory = 'amrc' | 'cooperation' | 'global';

/**
 * One marker on the cluster-geography map. Mirrors the `Marker` shape in
 * `MiniMap.svelte` — kept here (rather than imported) so this module has no
 * dependency on the chart component itself. The extra `category` field is
 * used by the overview page's legend toggle and ignored by `MiniMap`.
 */
export interface ClusterPartner {
	category: PartnerCategory;
	latitude: number;
	longitude: number;
	label: string;
	sublabel?: string;
	iconUrl?: string;
	color?: string;
	href?: string;
}

/** Singular sublabel shown in each marker's popup. */
export const PARTNER_SUBLABELS = {
	amrc: 'African Cluster Centre (AMRC)',
	privileged: 'Privileged partner',
	cooperation: 'Cooperation partner',
	global: 'Global partner Center of African Studies'
} as const;

/** Plural label shown in the map legend. */
export const PARTNER_LEGEND_LABELS = {
	cooperation: 'Cooperation partners',
	global: 'Global partner Centers of African Studies'
} as const;

/** Dot colour per category. AMRCs and the privileged partner use logos, so
 *  no colour is needed for them. */
export const PARTNER_COLORS = {
	cooperation: CHART_COLORS[3], // Iris
	global: CHART_COLORS[2] // Honey
} as const;

function buildAmrcLocations(): ClusterPartner[] {
	return [
		{
			category: 'amrc',
			latitude: 49.9457,
			longitude: 11.5775,
			label: 'University of Bayreuth',
			sublabel: 'Cluster lead',
			iconUrl: `${base}/logos/UBT.webp`,
			href: institutionUrl('University of Bayreuth')
		},
		{
			category: 'amrc',
			latitude: 12.3714,
			longitude: -1.5197,
			label: 'Université Joseph Ki-Zerbo',
			sublabel: PARTNER_SUBLABELS.amrc,
			iconUrl: `${base}/logos/UJKZ.webp`,
			href: institutionUrl('Universite Joseph Ki-Zerbo')
		},
		{
			category: 'amrc',
			latitude: 6.5244,
			longitude: 3.3792,
			label: 'University of Lagos',
			sublabel: PARTNER_SUBLABELS.amrc,
			iconUrl: `${base}/logos/ULG.webp`,
			href: institutionUrl('University of Lagos')
		},
		{
			category: 'amrc',
			latitude: 0.5143,
			longitude: 35.2698,
			label: 'Moi University',
			sublabel: PARTNER_SUBLABELS.amrc,
			iconUrl: `${base}/logos/Moi.webp`,
			href: institutionUrl('Moi University')
		},
		{
			category: 'amrc',
			latitude: -33.3117,
			longitude: 26.5197,
			label: 'Rhodes University',
			sublabel: PARTNER_SUBLABELS.amrc,
			iconUrl: `${base}/logos/Rhodes_University.webp`,
			href: institutionUrl('Rhodes University')
		},
		{
			category: 'amrc',
			latitude: -12.9974,
			longitude: -38.5124,
			label: 'Centro de Estudos Afro-Orientais (CEAO) at the Universidade Federal da Bahia (UFBA)',
			sublabel: PARTNER_SUBLABELS.privileged,
			iconUrl: `${base}/logos/UFBA.webp`,
			href: institutionUrl('Universidade Federal da Bahia')
		}
	];
}

type RawPartner = Omit<ClusterPartner, 'category' | 'sublabel' | 'color'>;

const COOPERATION_PARTNERS: ReadonlyArray<RawPartner> = [
	{
		latitude: 44.8073,
		longitude: -0.6024,
		label: 'Les Afriques dans le Monde (LAM), Sciences Po Bordeaux'
	},
	{
		latitude: 14.6921,
		longitude: -17.4467,
		label:
			'Council for the Development of Social Science Research in Africa (CODESRIA), Dakar, Senegal'
	},
	{
		latitude: 6.4156,
		longitude: 2.3447,
		label: 'Université d’Abomey-Calavi, Cotonou, Benin'
	},
	{
		latitude: -6.779,
		longitude: 39.2083,
		label: 'University of Dar es Salaam, Tanzania'
	},
	{
		latitude: 33.9716,
		longitude: -6.8498,
		label: 'Mohammed V University of Rabat, Morocco'
	},
	{
		latitude: 35.8245,
		longitude: 10.6346,
		label: 'Université de Sousse, Tunisia'
	},
	{
		latitude: -25.951,
		longitude: 32.6053,
		label: 'Universidade Eduardo Mondlane, Maputo, Mozambique'
	},
	{
		latitude: 37.5973,
		longitude: 127.0586,
		label: 'Institute of African Studies, Hankuk University of Foreign Studies, Seoul, South Korea'
	},
	{
		latitude: 28.5403,
		longitude: 77.167,
		label: 'Centre for African Studies, Jawaharlal Nehru University, New Delhi, India'
	},
	{
		latitude: 12.6392,
		longitude: -8.0029,
		label: 'Point Sud — Centre for Research on Local Knowledge, Bamako, Mali'
	},
	{
		latitude: 5.651,
		longitude: -0.1864,
		label: 'Merian Institute for Advanced Studies in Africa (MIASA), University of Ghana, Legon'
	}
];

const GLOBAL_PARTNERS: ReadonlyArray<RawPartner> = [
	{
		latitude: 45.5048,
		longitude: -73.6131,
		label: 'Université de Montréal, Canada'
	},
	{
		latitude: 43.6629,
		longitude: -79.3957,
		label: 'University of Toronto, Canada'
	},
	{
		latitude: 39.1683,
		longitude: -86.5235,
		label: 'African Studies Program, Indiana University Bloomington, USA'
	},
	{
		latitude: 20.0263,
		longitude: -75.8242,
		label: 'Universidad de Oriente (UO), Santiago de Cuba, Cuba'
	},
	{
		latitude: 9.9377,
		longitude: -84.05,
		label: 'Universidad de Costa Rica (UCR), San José, Costa Rica'
	},
	{
		latitude: 10.4236,
		longitude: -75.544,
		label: 'Universidad de Cartagena, Colombia'
	},
	{
		latitude: 35.0264,
		longitude: 135.7813,
		label: 'Center for African Area Studies, Kyoto University, Japan'
	},
	{
		latitude: -32.0058,
		longitude: 115.8949,
		label: 'Curtin University, Perth, Australia'
	},
	{
		latitude: -29.8676,
		longitude: 30.981,
		label:
			'African Institute in Indigenous Knowledge Systems, University of KwaZulu-Natal, Durban, South Africa'
	}
];

/**
 * Build the full marker list for the overview-page cluster-geography map:
 * AMRCs (with logos), then cooperation partners and global partner Centers
 * of African Studies (rendered as colour-coded dots, distinguished by
 * `PARTNER_COLORS`).
 */
export function buildClusterPartnerLocations(): ClusterPartner[] {
	const cooperation: ClusterPartner[] = COOPERATION_PARTNERS.map((p) => ({
		...p,
		category: 'cooperation',
		sublabel: PARTNER_SUBLABELS.cooperation,
		color: PARTNER_COLORS.cooperation
	}));
	const global: ClusterPartner[] = GLOBAL_PARTNERS.map((p) => ({
		...p,
		category: 'global',
		sublabel: PARTNER_SUBLABELS.global,
		color: PARTNER_COLORS.global
	}));
	return [...buildAmrcLocations(), ...cooperation, ...global];
}
