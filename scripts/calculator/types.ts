export type PlanetName =
  | 'sun' | 'moon' | 'mercury' | 'venus' | 'mars'
  | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto'
  | 'northNode' | 'southNode' | 'chiron';

export interface PlanetPosition {
  tropicalLng: number;    // 0-360 ecliptic longitude in tropical zodiac
  speed: number;          // degrees/day (negative = retrograde)
  retrograde: boolean;
}

export interface EphemerisResult {
  utcDatetime: Date;
  lat: number;
  lng: number;
  planets: Record<PlanetName, PlanetPosition>;
  ascendant: number;      // tropical degrees 0-360
  midheaven: number;      // tropical degrees 0-360
}

export interface BirthData {
  birthDate: string;      // 'YYYY-MM-DD'
  birthTime: string;      // 'HH:MM' 24-hour local time
  timezone: string;       // IANA tz e.g. 'Europe/Berlin'
  lat: number;
  lng: number;
}

export type ZodiacSign = 'Aries' | 'Taurus' | 'Gemini' | 'Cancer' | 'Leo' | 'Virgo'
  | 'Libra' | 'Scorpio' | 'Sagittarius' | 'Capricorn' | 'Aquarius' | 'Pisces';

export type Dignity = 'domicile' | 'exaltation' | 'detriment' | 'fall' | 'peregrine';

export interface WesternPlanetData {
  planet: PlanetName;
  sign: ZodiacSign;
  degree: number;         // 0-29.99 within sign
  retrograde: boolean;
  house: number;          // 1-12
  dignity: Dignity;
}

export interface Aspect {
  planet1: PlanetName;
  planet2: PlanetName;
  type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
  orb: number;
  applying: boolean;
}

export interface WesternChart {
  planets: Partial<Record<PlanetName, WesternPlanetData>>;
  houses: number[];       // 12 cusp degrees tropical
  houseSystem: 'placidus' | 'whole-sign';
  aspects: Aspect[];
}

export type Nakshatra =
  'Ashwini' | 'Bharani' | 'Krittika' | 'Rohini' | 'Mrigashira' | 'Ardra' |
  'Punarvasu' | 'Pushya' | 'Ashlesha' | 'Magha' | 'Purva Phalguni' | 'Uttara Phalguni' |
  'Hasta' | 'Chitra' | 'Swati' | 'Vishakha' | 'Anuradha' | 'Jyeshtha' |
  'Mula' | 'Purva Ashadha' | 'Uttara Ashadha' | 'Shravana' | 'Dhanishtha' |
  'Shatabhisha' | 'Purva Bhadrapada' | 'Uttara Bhadrapada' | 'Revati';

export interface VedicPlanetData {
  planet: PlanetName;
  sign: ZodiacSign;
  degree: number;
  retrograde: boolean;
  nakshatra: Nakshatra;
  pada: 1 | 2 | 3 | 4;
  house: number;
}

export interface DashaPeriod {
  lord: string;
  start: Date;
  end: Date;
  subDashas?: DashaPeriod[];
}

export interface VedicChart {
  ayanamsa: number;
  planets: Partial<Record<PlanetName, VedicPlanetData>>;
  lagna: { sign: ZodiacSign; degree: number; nakshatra: Nakshatra; pada: 1|2|3|4 };
  houses: number[];
  dashas: DashaPeriod[];
  navamsha: Partial<Record<PlanetName, ZodiacSign>>;
}

export type HDType = 'Generator' | 'Manifesting Generator' | 'Manifestor' | 'Projector' | 'Reflector';
export type HDAuthority = 'Emotional' | 'Sacral' | 'Splenic' | 'Ego' | 'Self-Projected' | 'Mental' | 'Lunar' | 'None';
export type HDDefinition = 'Single' | 'Split' | 'Triple Split' | 'Quadruple Split' | 'None';
export type HDCenter = 'Head' | 'Ajna' | 'Throat' | 'G' | 'Will' | 'Solar Plexus' | 'Sacral' | 'Spleen' | 'Root';

export interface GateActivation {
  gate: number;           // 1-64
  line: 1 | 2 | 3 | 4 | 5 | 6;
  center: HDCenter;
}

export interface HDActivations {
  sun: GateActivation;
  earth: GateActivation;
  moon: GateActivation;
  northNode: GateActivation;
  southNode: GateActivation;
  mercury: GateActivation;
  venus: GateActivation;
  mars: GateActivation;
  jupiter: GateActivation;
  saturn: GateActivation;
  uranus: GateActivation;
  neptune: GateActivation;
  pluto: GateActivation;
}

export interface HumanDesignChart {
  type: HDType;
  authority: HDAuthority;
  profile: string;        // '1/3', '2/4', etc.
  definition: HDDefinition;
  designDate: Date;
  conscious: HDActivations;
  unconscious: HDActivations;
  definedCenters: HDCenter[];
  undefinedCenters: HDCenter[];
  definedChannels: string[];   // e.g. ['64-47', '1-8']
}

export interface ChartResult {
  birthData: BirthData;
  utcBirthDatetime: Date;
  western: WesternChart;
  vedic: VedicChart;
  humanDesign: HumanDesignChart;
}
