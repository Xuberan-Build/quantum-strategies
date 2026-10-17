import { describe, expect, it } from 'vitest';
import { adjacency, isNodeId, neighbourhood, nodeApiPath, parseGraphQuery, viewFromParams, viewToQuery, withDegree } from '../graph';
import { fixtureGraph } from '../graph-fixture';

describe('knowledge graph helpers', () => {
  it('validates node ids', () => {
    expect(isNodeId('problem:sample-1')).toBe(true);
    expect(isNodeId('note:folder/file.md')).toBe(true);
    for (const bad of ['', 'nocolon', 'Problem:x', 'problem:', 'problem:a b', 'problem:a,b', 'problem:(x)', 'note:../x', 'problem:"x"']) {
      expect(isNodeId(bad)).toBe(false);
    }
    expect(nodeApiPath('note:folder/a b')).toBe('/api/admin/brain/graph/node/note%3Afolder/a%20b');
  });

  it('parses the API query, dropping unknown types and capping the limit', () => {
    const q = parseGraphQuery(new URLSearchParams('types=pillar,nope,quote&edgeTypes=voices,zzz&minWeight=0.3&limit=99999'));
    expect(q).toEqual({ types: ['pillar', 'quote'], edgeTypes: ['voices'], minWeight: 0.3, limit: 5000 });
    expect(parseGraphQuery(new URLSearchParams('')).minWeight).toBeNull();
  });

  it('round-trips view state through the URL and keeps plain views plain', () => {
    expect(viewToQuery(viewFromParams(new URLSearchParams('')))).toBe('');
    const qs = 'node=problem%3Ap1&types=problem%2Cquote&edges=voices&minWeight=0.25&tier=evidence&orphans=0&gaps=1&depth=2&local=1';
    expect(viewToQuery(viewFromParams(new URLSearchParams(qs)))).toBe(qs);
    expect(viewFromParams(new URLSearchParams('node=bad id&tier=<x>&depth=9')).node).toBeNull();
  });

  it('computes degree and neighbourhoods', () => {
    const g = withDegree(
      [
        { id: 'a:1', type: 'a', label: '1', weight: 1, tier: null },
        { id: 'a:2', type: 'a', label: '2', weight: 1, tier: null },
        { id: 'a:3', type: 'a', label: '3', weight: 1, tier: null },
      ],
      [
        { src: 'a:1', dst: 'a:2', type: 'links_to', weight: 1 },
        { src: 'a:2', dst: 'a:3', type: 'links_to', weight: 1 },
        { src: 'a:3', dst: 'a:9', type: 'links_to', weight: 1 },
      ],
    );
    expect(g.nodes.map((n) => n.degree)).toEqual([1, 2, 1]);
    expect(g.edges).toHaveLength(2);
    const adj = adjacency(g.edges);
    expect([...neighbourhood(adj, 'a:1', 1)]).toEqual(['a:1', 'a:2']);
    expect([...neighbourhood(adj, 'a:1', 2)].sort()).toEqual(['a:1', 'a:2', 'a:3']);
  });

  it('fixture has unique ids, valid edges and generic labels only', () => {
    const f = fixtureGraph();
    const ids = new Set(f.nodes.map((n) => n.id));
    expect(ids.size).toBe(f.nodes.length);
    expect(f.nodes.every((n) => isNodeId(n.id) && n.label.startsWith('Sample '))).toBe(true);
    expect(f.edges.every((e) => ids.has(e.src) && ids.has(e.dst))).toBe(true);
    expect(f.fixture).toBe(true);
  });
});
