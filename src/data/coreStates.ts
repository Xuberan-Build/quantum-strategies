export interface CoreState {
  id: string;
  name: string;
  glyph: string;
  color: string;
  definition: string;
  count: number;
  situations: string[];
  why: string;
}

export const CORE_STATES: CoreState[] = [
  {
    id: "being",
    name: "Being",
    glyph: "◯",
    color: "#d4a574",
    definition:
      "Self-awareness and presence prior to action. Consciousness aware of itself in a body.",
    count: 2,
    situations: ["Morning Wake", "Deadline Pressure"],
    why: "Bookends and load points — start of day, under pressure",
  },
  {
    id: "inner-peace",
    name: "Inner Peace",
    glyph: "≋",
    color: "#9ab8a3",
    definition:
      "Tranquility that holds amidst challenge. Absence of internal noise. Groundedness.",
    count: 3,
    situations: ["Difficult Conversations", "Task Switching", "Evening Wind Down"],
    why: "Transition and regulation — anywhere internal noise threatens output",
  },
  {
    id: "love",
    name: "Love",
    glyph: "◈",
    color: "#c98a8a",
    definition:
      "Unconditional regard that does not require the other to be different than they are.",
    count: 3,
    situations: ["1:1 Meetings", "Intimate Partnership", "Vulnerable Conversations"],
    why: "Relational situations — anywhere another person's reality matters",
  },
  {
    id: "okness",
    name: "OKness",
    glyph: "◇",
    color: "#a89bc2",
    definition:
      "Felt sense of intrinsic worthiness independent of performance, outcome, or evaluation.",
    count: 4,
    situations: ["Presentations", "Discovery Calls", "Pitching", "Closing"],
    why: "Performance and visibility — anywhere you're evaluated",
  },
  {
    id: "oneness",
    name: "Oneness",
    glyph: "∞",
    color: "#7ba8c4",
    definition:
      "Dissolution of the felt boundary between self and experience. Merger of action and awareness.",
    count: 1,
    situations: ["Deep Work"],
    why: "Rare merger state — deep work specifically",
  },
];
