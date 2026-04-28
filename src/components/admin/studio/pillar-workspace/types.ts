export interface Pillar {
  id: string; title: string; format: string; audience: string | null;
  goal: string | null; angle: string | null; tone: string;
  tradition_filter: string | null; corpus_query: string | null;
  status: string; metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
}

export interface Section {
  id: string; angle_id: string; order_index: number;
  title: string; description: string | null; body: string | null;
  version_history: Array<{ body: string; updated_at: string }>;
  status: string; created_at: string; updated_at: string;
}

export interface Piece {
  id: string; angle_id: string; parent_section_id: string | null;
  piece_type: string; title: string | null; body: string | null;
  platform_meta: Record<string, unknown>; version_history: unknown[];
  status: string; created_at: string;
}

export interface CorpusLink {
  id: string; similarity: number | null; curated: boolean; created_at: string;
  knowledge_chunks: {
    id: string; tradition: string; text_name: string; author: string | null;
    section: string | null; chapter: string | null; content: string;
    themes: string[]; source_url: string | null; priority: number;
  };
}
