/**
 * Sigma rendering pieces for the Obsidian-style graph: a glowing disc node program and
 * dark-theme label / hover drawers. Imported dynamically (sigma touches WebGL globals at
 * module load), never on the server.
 */
import type { Attributes } from 'graphology-types';
import type { NodeDisplayData, PartialButFor } from 'sigma/types';
import type { Settings } from 'sigma/settings';

// Same attributes as sigma's NodeCircleProgram; the triangle is drawn twice as large so the
// disc keeps its radius and gains a soft halo out to 2x radius. Picking uses the core only.
const VERTEX = /* glsl */ `
attribute vec4 a_id;
attribute vec4 a_color;
attribute vec2 a_position;
attribute float a_size;
attribute float a_angle;

uniform mat3 u_matrix;
uniform float u_sizeRatio;
uniform float u_correctionRatio;

varying vec4 v_color;
varying vec2 v_diffVector;
varying float v_radius;

const float bias = 255.0 / 254.0;

void main() {
  float size = a_size * u_correctionRatio / u_sizeRatio * 8.0;
  vec2 diffVector = size * vec2(cos(a_angle), sin(a_angle));
  vec2 position = a_position + diffVector;
  gl_Position = vec4((u_matrix * vec3(position, 1)).xy, 0, 1);

  v_diffVector = diffVector;
  v_radius = size / 4.0;

  #ifdef PICKING_MODE
  v_color = a_id;
  #else
  v_color = a_color;
  #endif

  v_color.a *= bias;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;

varying vec4 v_color;
varying vec2 v_diffVector;
varying float v_radius;

uniform float u_correctionRatio;

void main(void) {
  float dist = length(v_diffVector);

  #ifdef PICKING_MODE
  if (dist > v_radius)
    gl_FragColor = vec4(0.0);
  else
    gl_FragColor = v_color;
  #else
  float border = u_correctionRatio * 2.0;
  float core = 1.0 - smoothstep(v_radius - border, v_radius, dist);
  float halo = 1.0 - smoothstep(v_radius * 0.9, v_radius * 2.0, dist);
  halo = halo * halo * 0.34;
  float a = (core + halo * (1.0 - core)) * v_color.a;
  gl_FragColor = vec4(v_color.rgb * a, a);
  #endif
}
`;

export async function loadSigma() {
  const [{ default: Sigma }, rendering, { default: Graph }, { default: FA2Layout }, fa2] = await Promise.all([
    import('sigma'),
    import('sigma/rendering'),
    import('graphology'),
    import('graphology-layout-forceatlas2/worker'),
    import('graphology-layout-forceatlas2'),
  ]);
  const { NodeCircleProgram } = rendering;

  class NodeGlowProgram extends NodeCircleProgram {
    getDefinition() {
      return { ...super.getDefinition(), VERTEX_SHADER_SOURCE: VERTEX, FRAGMENT_SHADER_SOURCE: FRAGMENT };
    }
  }

  return { Sigma, Graph, FA2Layout, inferSettings: fa2.default.inferSettings, NodeGlowProgram };
}

type LabelData = PartialButFor<NodeDisplayData, 'x' | 'y' | 'size' | 'label' | 'color'>;

const INK = '239, 230, 214';

/** Labels sit under the dot and fade in as the node's rendered size grows with zoom. */
export function drawFadingLabel(ctx: CanvasRenderingContext2D, data: LabelData, settings: Settings<Attributes, Attributes, Attributes>) {
  if (!data.label) return;
  const alpha = data.forceLabel ? 1 : Math.max(0, Math.min(1, (data.size - 4.5) / 4));
  if (alpha < 0.03) return;
  const size = settings.labelSize;
  ctx.save();
  ctx.font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = `rgba(${INK}, ${alpha * 0.92})`;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 4;
  ctx.fillText(data.label, data.x, data.y + data.size + 3);
  ctx.restore();
}

/** Hover: a soft ring in the node's colour and a dark pill label. */
export function drawGlowHover(ctx: CanvasRenderingContext2D, data: LabelData, settings: Settings<Attributes, Attributes, Attributes>) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(data.x, data.y, data.size + 3, 0, Math.PI * 2);
  ctx.strokeStyle = data.color;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = data.color;
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.restore();
  if (!data.label) return;
  const size = settings.labelSize + 1;
  ctx.save();
  ctx.font = `600 ${size}px ${settings.labelFont}`;
  const w = ctx.measureText(data.label).width;
  const padX = 7;
  const h = size + 8;
  const x = data.x - w / 2 - padX;
  const y = data.y + data.size + 4;
  ctx.fillStyle = 'rgba(14, 11, 9, 0.9)';
  ctx.strokeStyle = 'rgba(180, 140, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const r = h / 2;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w + padX * 2, y, x + w + padX * 2, y + h, r);
  ctx.arcTo(x + w + padX * 2, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w + padX * 2, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = `rgb(${INK})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.label, data.x, y + h / 2 + 0.5);
  ctx.restore();
}

/** Mix a #rrggbb colour toward the plane colour. */
export function dim(hex: string, keep = 0.18, plane: [number, number, number] = [14, 11, 9]): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return '#2a241d';
  const c = [1, 2, 3].map((i) => parseInt(m[i], 16));
  const mixed = c.map((v, i) => Math.round(v * keep + plane[i] * (1 - keep)));
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return `rgba(196, 184, 165, ${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}
