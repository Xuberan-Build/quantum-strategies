/**
 * Studio adapter for the video-script format (server-only).
 *
 * Turns a content angle (+ its sections and curated passages) into validated video
 * scripts: generate JSON → validate → one repair pass → piece rows ready to insert.
 * Rules and voice come from the voice pack at runtime; nothing brand-specific lives here.
 */
import { openai, DEFAULT_MODEL } from '@/lib/openai/client';
import { getVoicePackResult, buildVoiceSystemPrompt } from '@/lib/content/voice-pack';
import { renderVideoScript, VIDEO_SCRIPT_SCHEMA_VERSION, type VideoScriptRules, type VideoVariant } from './video-script';
import { generateValidatedVideoScript, type CompleteFn } from './video-script-generate';

/** Distribute types handled by this adapter. Both store as piece_type 'video_script'. */
export const VIDEO_DISTRIBUTE_TYPES = {
  video_script: 'long',
  video_short: 'short',
} as const satisfies Record<string, VideoVariant>;
export type VideoDistributeType = keyof typeof VIDEO_DISTRIBUTE_TYPES;

export function isVideoDistributeType(t: string): t is VideoDistributeType {
  return t in VIDEO_DISTRIBUTE_TYPES;
}

/** The content_pieces.piece_type value used for every video variant (variant lives in platform_meta). */
export const VIDEO_PIECE_TYPE = 'video_script';

export interface VideoAngleInput {
  id: string;
  title: string;
  angle?: string | null;
  audience?: string | null;
  goal?: string | null;
  metadata?: unknown;
}

export interface VideoPieceRow {
  angle_id: string;
  parent_section_id: null;
  piece_type: string;
  title: string;
  body: string;
  platform_meta: Record<string, unknown>;
}

export interface VideoPieceFailure {
  type: VideoDistributeType;
  error: string;
}

function metaString(meta: unknown, key: string): string | null {
  if (meta && typeof meta === 'object' && key in meta) {
    const v = (meta as Record<string, unknown>)[key];
    return typeof v === 'string' && v.trim() ? v : null;
  }
  return null;
}

function openAiComplete(maxTokens: number): CompleteFn {
  return async (system, user) => {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: maxTokens,
    });
    return completion.choices[0]?.message?.content ?? '';
  };
}

/**
 * Generate validated video scripts for the requested types, in parallel.
 * Failing validation still yields a draft piece (with the failing validation stored) so a
 * human can fix it; only unparseable output or a model error becomes a failure.
 */
export async function buildVideoScriptPieces(args: {
  angle: VideoAngleInput;
  types: VideoDistributeType[];
  material: string;
  sources: string;
  complete?: (variant: VideoVariant) => CompleteFn;
}): Promise<{ pieces: VideoPieceRow[]; failures: VideoPieceFailure[] }> {
  const { angle, types, material, sources } = args;
  const voice = await getVoicePackResult();
  const rules: VideoScriptRules = {
    bannedTerms: voice.pack.bannedTerms,
    handleWithCare: voice.pack.handleWithCare,
    ctaSpamPatterns: voice.pack.ctaSpamPatterns,
    outcomeTimeboxPatterns: voice.pack.outcomeTimeboxPatterns,
  };
  const voiceGuide = buildVoiceSystemPrompt(voice.pack, {
    role: 'You write video scripts: spoken word for camera, plus on-screen text and b-roll cues.',
    includeCanon: true,
  });

  const settled = await Promise.allSettled(
    types.map(async (type) => {
      const variant = VIDEO_DISTRIBUTE_TYPES[type];
      const complete = args.complete?.(variant) ?? openAiComplete(variant === 'long' ? 9000 : 3000);
      const result = await generateValidatedVideoScript({
        variant,
        rules,
        voiceGuide,
        complete,
        brief: {
          title: angle.title,
          angle: angle.angle,
          audience: angle.audience,
          goal: angle.goal,
          rite: metaString(angle.metadata, 'rite'),
          pillar: metaString(angle.metadata, 'pillar'),
          domain: metaString(angle.metadata, 'domain'),
          ctaTarget: metaString(angle.metadata, 'cta_target') ?? 'the free quiz',
          material: material.slice(0, 12000),
          sources: sources ? sources.slice(0, 8000) : undefined,
        },
      });
      const { validation } = result;
      if (!validation.script) {
        throw new Error(`Model output did not parse as a video script: ${validation.errors.slice(0, 3).map((e) => e.message).join('; ')}`);
      }
      const { script, ...validationRest } = validation;
      const row: VideoPieceRow = {
        angle_id: angle.id,
        parent_section_id: null,
        piece_type: VIDEO_PIECE_TYPE,
        title: script.title,
        body: renderVideoScript(script, validation),
        platform_meta: {
          format: 'video_script',
          variant,
          distribute_type: type,
          schema_version: VIDEO_SCRIPT_SCHEMA_VERSION,
          script,
          validation: validationRest,
          attempts: result.attempts,
          attempt_history: result.history,
          voice_pack: { source: voice.source, version: voice.pack.version },
          model: DEFAULT_MODEL,
        },
      };
      return row;
    }),
  );

  const pieces: VideoPieceRow[] = [];
  const failures: VideoPieceFailure[] = [];
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') pieces.push(s.value);
    else failures.push({ type: types[i], error: s.reason instanceof Error ? s.reason.message : String(s.reason) });
  });
  return { pieces, failures };
}
