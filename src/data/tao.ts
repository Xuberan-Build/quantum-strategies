/**
 * TAO (Table of Alignment Operators) — type definitions and placeholder exports.
 *
 * The full 172-situation corpus lives in the `tao_situations` Postgres table
 * and will be wired up to this page in a later pass. For now the static
 * dossier renders TAOTable with an empty situation array.
 */

export type FateDriver = "Fear" | "Authority" | "Trust" | "Ego";

export interface TaoDomain {
  id: string;
  name: string;
  color: string;
}

export interface TaoSituation {
  id: string;
  name: string;
  domain: string;
  domainId?: string;
  tier: 1 | 2 | 3;
  variantCount: number;
  fate: FateDriver | null;
  beingName?: string | null;
  reEntryPhrase?: string | null;
  kinesthetic?: string | null;
  bteElements?: string | null;
  bteConfirming?: string[];
  bteConflicting?: string[];
  bteLevers?: string[];
  somaticBreathOn?: string[];
  somaticBreathOff?: string[];
  somaticArousalOn?: string | null;
  somaticArousalOff?: string | null;
  somaticLipsOn?: string | null;
  somaticJawOn?: string | null;
  somaticBrowOn?: string | null;
  somaticSymmetryOn?: string | null;
  somaticLipsOff?: string | null;
  somaticJawOff?: string | null;
  somaticBrowOff?: string | null;
  somaticSymmetryOff?: string | null;
  somaticTensionMap?: string | null;
  somaticBodyOn?: string[];
  somaticBodyOff?: string[];
  somaticVoiceOn?: string | null;
  somaticVoiceOff?: string | null;
  somaticGazeOn?: string | null;
  somaticGazeOff?: string | null;
}

export const FATE_COLORS: Record<FateDriver, string> = {
  Fear: "#7a8fa6",
  Authority: "#a67a8f",
  Trust: "#8fa67a",
  Ego: "#a6977a",
};

/**
 * 22 domains. Colors mirror the sibling project; the rest will eventually
 * be sourced from the `tao_situations` table.
 */
export const TAO_DOMAINS: TaoDomain[] = [
  { id: "01", name: "Home", color: "#888" },
  { id: "02", name: "Work", color: "#888" },
  { id: "03", name: "Creative / Flow", color: "#888" },
  { id: "04", name: "Digital / Online", color: "#7a9e8b" },
  { id: "05", name: "Physical / Body", color: "#9e7a8b" },
  { id: "06", name: "Transit / Between", color: "#888" },
  { id: "07", name: "Private / Solo in Public", color: "#888" },
  { id: "08", name: "Social / In the World", color: "#888" },
  { id: "09", name: "Relational - Close", color: "#888" },
  { id: "10", name: "Sales / Influence", color: "#c4a882" },
  { id: "11", name: "Financial", color: "#888" },
  { id: "12", name: "Learning / Growth", color: "#a882c4" },
  { id: "13", name: "Spiritual / Ritual", color: "#888" },
  { id: "14", name: "Community / Civic", color: "#888" },
  { id: "15", name: "Safety / Security", color: "#888" },
  { id: "16", name: "Crisis / High Pressure", color: "#888" },
  { id: "17", name: "Rest / Recovery", color: "#a0c4c4" },
  { id: "18", name: "Romance & Dating", color: "#888" },
  { id: "19", name: "Parenting & Children", color: "#888" },
  { id: "20", name: "Health & Medical", color: "#888" },
  { id: "21", name: "Travel & Adventure", color: "#888" },
  { id: "22", name: "Entertainment & Gaming", color: "#888" },
];

/**
 * Optional lookup by domain name for color resolution. The data table
 * keeps both `domain` (display name) and `domainId` (numeric code).
 */
export const DOMAIN_COLORS: Record<string, string> = Object.fromEntries(
  TAO_DOMAINS.map((d) => [d.name, d.color])
);
