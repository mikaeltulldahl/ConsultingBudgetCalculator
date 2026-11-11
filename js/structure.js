// Draws the structure: a map (wide screens) and a vertical flow list (phones).
// Every box and arrow carries data-goto="<part>" so the page can show that part's card.
// Parts that belong to a person carry the person id: person-p1, lon-p1, pension-p1,
// utdelning-p1, annan-p1.
//
// The structure: one or more assignments, one company, one or more people (owners and/or
// employees), and other employments per person. The drawing works from a list of nodes
// and edges.

const fmt = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString('sv-SE') : '–');

// v.assignments: [{ id, name, rates: [hourly rates], amount, manual }]
// v.people: [{ id, name, employed, owner, ownership, grossSalaryYear, pension, grossDividends,
//              netSumMonth, otherEmployer (or null), otherSalaryYear }]
export function buildStructure(v) {
  const n = v.assignments.length;
  const others = v.people.filter((p) => p.otherEmployer);
  const leftRows = n + others.length;
  const rows = Math.max(leftRows, v.people.length);
  const leftTop = (rows - leftRows) / 2;
  const peopleTop = (rows - v.people.length) / 2;
  const middle = (rows - 1) / 2; // the company sits in the middle
  const several = v.people.length > 1;
  const rateText = (rates) => {
    if (!rates.length) return 'timpris saknas';
    const lo = Math.min(...rates);
    const hi = Math.max(...rates);
    return lo === hi ? `${fmt(lo)} kr/h` : `${fmt(lo)}–${fmt(hi)} kr/h`;
  };
  const personSub = (p) => {
    const net = Number.isFinite(p.netSumMonth) ? `${fmt(p.netSumMonth)} kr/mån` : 'fyll i uppgifter';
    return several && p.owner ? `${fmt(p.ownership)} % · ${net}` : net;
  };
  const structure = {
    columns: ['Inkomstkällor', 'Bolag', several ? 'Personer' : 'Person'],
    nodes: [
      ...v.assignments.map((a, i) => ({ id: `uppdrag-${a.id}`, type: 'source', name: a.name, sub: rateText(a.rates), col: 0, row: leftTop + i })),
      { id: 'bolag', type: 'bolag', name: 'Ditt aktiebolag', sub: `resultat ${fmt(v.profitAfterTax)}`, col: 1, row: middle },
      ...others.map((p, i) => ({ id: `annan-${p.id}`, type: 'source', name: p.otherEmployer, sub: `lön ${fmt(p.otherSalaryYear)}/år`, col: 0, row: leftTop + n + i })),
      ...v.people.map((p, i) => ({ id: `person-${p.id}`, type: 'person', name: p.name, sub: personSub(p), col: 2, row: peopleTop + i })),
    ],
    edges: [
      ...v.assignments.map((a) => ({ goto: `faktura-${a.id}`, from: `uppdrag-${a.id}`, to: 'bolag', label: `${fmt(a.amount)}`, title: 'Fakturerat', manual: a.manual })),
      ...v.people.flatMap((p) => [
        ...(p.employed ? [
          { goto: `lon-${p.id}`, person: p.id, from: 'bolag', to: `person-${p.id}`, label: `lön ${fmt(p.grossSalaryYear)}`, title: 'Lön', offset: -0.42 },
          { goto: `pension-${p.id}`, person: p.id, from: 'bolag', to: `person-${p.id}`, label: `pension ${fmt(p.pension)}`, title: 'Pension', offset: 0 },
        ] : []),
        ...(p.owner ? [{ goto: `utdelning-${p.id}`, person: p.id, from: 'bolag', to: `person-${p.id}`, label: `utdelning ${fmt(p.grossDividends)}`, title: 'Utdelning', offset: 0.42 }] : []),
        ...(p.otherEmployer ? [{ goto: `annan-${p.id}`, person: p.id, from: `annan-${p.id}`, to: `person-${p.id}`, label: `lön ${fmt(p.otherSalaryYear)}`, title: 'Annan lön', enterFromBelow: true }] : []),
      ]),
    ],
  };
  // Several people: the arrows leave the company spread over its box, and their labels sit
  // near the person they go to, so they do not cross each other's labels.
  if (several) {
    const out = structure.edges.filter((e) => e.from === 'bolag');
    out.forEach((e, k) => { e.fan = { k, count: out.length }; });
  }
  return structure;
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
    let mx = (x1 + x2) / 2;
    let d = `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
    let ly = (y1 + y2) / 2 + (e.offset ?? 0) * 30;
    let lx = mx;
    if (e.fan) {
      const fy1 = a.y + NODE_H * (e.fan.k + 1) / (e.fan.count + 1);
      d = `M${x1} ${fy1} C ${mx} ${fy1}, ${mx} ${y2}, ${x2} ${y2}`;
      // The point on the curve at t = 0.8.
      const t = 0.8;
      const b = [(1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3];
      lx = b[0] * x1 + (b[1] + b[2]) * mx + b[3] * x2;
      ly = (b[0] + b[1]) * fy1 + (b[2] + b[3]) * y2;
    }
    if (e.enterFromBelow) {
      // Into the bottom of the target box, so it does not cross the arrows from the side.
      const bx = b.x + NODE_W / 2;
      const by = b.y + NODE_H + 8;
      d = `M${x1} ${y1} C ${bx} ${y1}, ${bx} ${y1}, ${bx} ${by}`;
      lx = (x1 + bx) / 2;
      ly = y1;
    }
    const lw = e.label.length * 6 + 14;
    return `<g class="edge ${e.goto === selected ? 'selected' : ''}" data-goto="${e.goto}" role="button" tabindex="0" aria-label="${esc(`${e.title}: ${e.label}`)}">
      <path class="line" d="${d}" marker-end="url(#arrowhead)" ${e.manual ? 'stroke-dasharray="4 4"' : ''}/><path class="hit" d="${d}"/>
      <rect x="${lx - lw / 2}" y="${ly - (e.fan ? 9 : 10)}" width="${lw}" height="${e.fan ? 18 : 20}" rx="9"/>
      <text x="${lx}" y="${ly + 4}" font-size="11" text-anchor="middle" fill="currentColor">${esc(e.label)}</text></g>`;
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
  const btn = (goto, cls, label, sub, isSelected) =>
    `<button type="button" class="${cls} ${isSelected ? 'selected' : ''}" data-goto="${goto}"><span>${esc(label)}</span><small>${esc(sub)}</small></button>`;
  const n = (id) => btn(id, `t-${node(id).type}`, node(id).name, node(id).sub, selected === id);
  const e = (ed) => btn(ed.goto, 't-edge', ed.title, ed.label.replace(/^(lön|pension|utdelning) /, ''), selected === ed.goto);
  const assignmentRows = structure.edges.filter((ed) => ed.title === 'Fakturerat').map((ed) => n(ed.from) + e(ed)).join('');
  const people = structure.nodes.filter((x) => x.type === 'person').map((p) => {
    const edges = structure.edges.filter((ed) => ed.to === p.id);
    const fromCompany = edges.filter((ed) => ed.from === 'bolag');
    const other = edges.find((ed) => ed.title === 'Annan lön');
    return `${fromCompany.length ? `<div class="flow-trio" style="grid-template-columns: repeat(${fromCompany.length}, minmax(0, 1fr))">${fromCompany.map(e).join('')}</div>` : ''}${other ? n(other.from) + e(other) : ''}${n(p.id)}`;
  }).join('');
  return `<div class="flow-list">${assignmentRows}${n('bolag')}${people}</div>`;
}
