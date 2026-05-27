import { supabaseAdmin } from "@/lib/supabase/server";
import type { TaoSituation, FateDriver } from "@/data/tao";

type DbRow = {
  id: string;
  domain_id: string;
  domain_name: string;
  name: string;
  tier: 1 | 2 | 3;
  fate: FateDriver | null;
  core_state: string | null;
  being_name: string | null;
  re_entry_phrase: string | null;
  variant_count: number | null;
  layer_identity: Record<string, unknown> | null;
  layer_submodality: Record<string, unknown> | null;
  layer_language: Record<string, unknown> | null;
  layer_fate_bte: Record<string, unknown> | null;
};

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function mapRow(row: DbRow): TaoSituation {
  const identity = row.layer_identity ?? {};
  const sub = row.layer_submodality ?? {};
  const fateBte = row.layer_fate_bte ?? {};

  return {
    id: row.id,
    name: row.name,
    domain: row.domain_name,
    domainId: row.domain_id,
    tier: row.tier,
    variantCount: row.variant_count ?? 0,
    fate: row.fate,
    beingName: row.being_name,
    reEntryPhrase: row.re_entry_phrase,
    kinesthetic: str(identity.kinesthetic),
    bteElements: str(identity.bte_elements),
    bteConfirming: strArr(fateBte.bte_confirming),
    bteConflicting: strArr(fateBte.bte_conflicting),
    bteLevers: strArr(fateBte.bte_levers),
    somaticBreathOn: strArr(sub.breath_on),
    somaticBreathOff: strArr(sub.breath_off),
    somaticArousalOn: str(sub.arousal_on),
    somaticArousalOff: str(sub.arousal_off),
    somaticLipsOn: str(sub.lips_on),
    somaticJawOn: str(sub.jaw_on),
    somaticBrowOn: str(sub.brow_on),
    somaticSymmetryOn: str(sub.symmetry_on),
    somaticLipsOff: str(sub.lips_off),
    somaticJawOff: str(sub.jaw_off),
    somaticBrowOff: str(sub.brow_off),
    somaticSymmetryOff: str(sub.symmetry_off),
    somaticTensionMap: str(sub.tension_map),
    somaticBodyOn: strArr(sub.body_on),
    somaticBodyOff: strArr(sub.body_off),
    somaticVoiceOn: str(sub.voice_on),
    somaticVoiceOff: str(sub.voice_off),
    somaticGazeOn: str(sub.gaze_on),
    somaticGazeOff: str(sub.gaze_off),
  };
}

export async function getActiveSituations(): Promise<TaoSituation[]> {
  const { data, error } = await supabaseAdmin
    .from("tao_situations")
    .select(
      "id, domain_id, domain_name, name, tier, fate, core_state, being_name, re_entry_phrase, variant_count, layer_identity, layer_submodality, layer_language, layer_fate_bte"
    )
    .eq("active", true)
    .order("id");

  if (error) {
    console.error("[tao/fetch] failed to load situations:", error.message);
    return [];
  }

  return (data as DbRow[]).map(mapRow);
}
