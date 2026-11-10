// Draws the structure: a map (wide screens) and a vertical flow list (phones).
// Every box and arrow carries data-goto="<part>" so the page can show that part's card.
//
// For now the structure is fixed: one assignment, one company, one person. The drawing
// works from a list of nodes and edges so more people, companies and income sources can be
// added later without changing how it is drawn.

const fmt = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString('sv-SE') : '–');

export function buildStructure(v) {
  return {
    columns: ['Inkomstkällor', 'Bolag', 'Personer'],
    nodes: [
      { id: 'uppdrag', type: 'source', name: 'Uppdrag', sub: Number.isFinite(v.hourlyRate) ? `${fmt(v.hourlyRate)} kr/h` : 'timpris saknas', col: 0, row: 0 },
      { id: 'bolag', type: 'bolag', name: 'Ditt aktiebolag', sub: `resultat ${fmt(v.profitAfterTax)}`, col: 1, row: 0 },
      { id: 'person', type: 'person', name: 'Du', sub: Number.isFinite(v.netSumMonth) ? `${fmt(v.netSumMonth)} kr/mån` : 'fyll i dina uppgifter', col: 2, row: 0 },
    ],
    edges: [
      { goto: 'faktura', from: 'uppdrag', to: 'bolag', label: `${fmt(v.invoicedAmount)}`, title: 'Fakturerat', manual: v.manualInvoiced },
      { goto: 'lon', from: 'bolag', to: 'person', label: `lön ${fmt(v.grossSalaryYear)}`, title: 'Lön', offset: -0.42 },
      { goto: 'pension', from: 'bolag', to: 'person', label: `pension ${fmt(v.pension)}`, title: 'Pension', offset: 0 },
      { goto: 'utdelning', from: 'bolag', to: 'person', label: `utdelning ${fmt(v.grossDividends)}`, title: 'Utdelning', offset: 0.42 },
    ],
  };
}

const COL_W = 290;
const NODE_W = 140;
const NODE_H = 50;
const ROW_H = 130;
const TOP = 30;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderMap(structure, selected) {
  const { columns, nodes, edges } = structure;
  const W = COL_W * columns.length;
  const rows = Math.max(...nodes.map((n) => n.row)) + 1;
  const H = TOP + rows * ROW_H - 20;
  const pos = Object.fromEntries(nodes.map((n) => [n.id, { x: COL_W * n.col + (COL_W - NODE_W) / 2, y: TOP + n.row * ROW_H }]));

  const edgeSvg = edges.map((e) => {
    const a = pos[e.from];
    const b = pos[e.to];
    const off = (e.offset ?? 0) * NODE_H;
    const x1 = a.x + NODE_W;
    const y1 = a.y + NODE_H / 2 + off;
    const x2 = b.x - 8;
    const y2 = b.y + NODE_H / 2 + off;
    const mx = (x1 + x2) / 2;
    const d = `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
    const lw = e.label.length * 6 + 14;
    const ly = (y1 + y2) / 2 + (e.offset ?? 0) * 30;
    return `<g class="edge ${e.goto === selected ? 'selected' : ''}" data-goto="${e.goto}" role="button" tabindex="0" aria-label="${esc(`${e.title}: ${e.label}`)}">
      <path class="line" d="${d}" marker-end="url(#arrowhead)" ${e.manual ? 'stroke-dasharray="4 4"' : ''}/><path class="hit" d="${d}"/>
      <rect x="${mx - lw / 2}" y="${ly - 10}" width="${lw}" height="20" rx="10"/>
      <text x="${mx}" y="${ly + 4}" font-size="11" text-anchor="middle" fill="currentColor">${esc(e.label)}</text></g>`;
  }).join('');

  const nodeSvg = nodes.map((n) => {
    const p = pos[n.id];
    return `<g class="node ${n.type} ${n.id === selected ? 'selected' : ''}" data-goto="${n.id}" role="button" tabindex="0" aria-label="${esc(`${n.name}: ${n.sub}`)}">
      <rect x="${p.x}" y="${p.y}" width="${NODE_W}" height="${NODE_H}" rx="10"/>
      <text x="${p.x + 12}" y="${p.y + 21}" font-size="14" font-weight="600" fill="currentColor">${esc(n.name)}</text>
      <text x="${p.x + 12}" y="${p.y + 39}" font-size="12" fill="currentColor" opacity=".7">${esc(n.sub)}</text></g>`;
  }).join('');

  const heads = columns.map((c, i) => `<text class="colhead" x="${COL_W * i + COL_W / 2}" y="14" text-anchor="middle">${esc(c)}</text>`).join('');
  return `<svg class="map" viewBox="0 0 ${W} ${H}" role="group" aria-label="Struktur" style="color: var(--text)">
    <defs><marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="var(--edge)"/></marker></defs>
    ${heads}${edgeSvg}${nodeSvg}</svg>`;
}

// Phones: the same structure as a vertical flow.
export function renderFlowList(structure, selected) {
  const node = (id) => structure.nodes.find((n) => n.id === id);
  const edge = (title) => structure.edges.find((e) => e.title === title);
  const btn = (goto, cls, label, sub, isSelected) =>
    `<button type="button" class="${cls} ${isSelected ? 'selected' : ''}" data-goto="${goto}"><span>${esc(label)}</span><small>${esc(sub)}</small></button>`;
  const n = (id) => btn(id, `t-${node(id).type}`, node(id).name, node(id).sub, selected === id);
  const e = (title) => {
    const ed = edge(title);
    return btn(ed.goto, 't-edge', title, ed.label.replace(/^(lön|pension|utdelning) /, ''), selected === ed.goto);
  };
  return `<div class="flow-list">${n('uppdrag')}${e('Fakturerat')}${n('bolag')}<div class="flow-trio">${e('Lön')}${e('Pension')}${e('Utdelning')}</div>${n('person')}</div>`;
}
