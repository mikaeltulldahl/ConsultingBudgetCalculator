// Draws the structure: a map (wide screens) and a vertical flow list (phones).
// Every box and arrow carries data-goto="<part>" so the page can show that part's card.
// Parts that belong to a person carry the person id: person-p1, lon-p1, pension-p1,
// utdelning-p1, annan-p1.
//
// The structure: one or more assignments, one company, one or more people (owners and/or
// employees), and other employments per person. The drawing works from a list of nodes
// and edges.

const fmt = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString('sv-SE') : '–');
const fmtShare = (v) => (Number.isFinite(v) ? v.toLocaleString('sv-SE', { maximumFractionDigits: 2 }) : '–');

// v.assignments: [{ id, name, rates: [hourly rates], amount, manual }]
// v.people: [{ id, name, employed, owner, ownership, grossSalaryYear, pension, grossDividends,
//              netSumMonth, otherEmployer (or null), otherSalaryYear }]
// v.otherOwners: { share (%), grossDividends } for owners not in the calculation, or null
export function buildStructure(v) {
  const n = v.assignments.length;
  const others = v.people.filter((p) => p.otherEmployer);
  const leftRows = n + others.length;
  const rightRows = v.people.length + (v.otherOwners ? 1 : 0);
  const rows = Math.max(leftRows, rightRows);
  const leftTop = (rows - leftRows) / 2;
  const peopleTop = (rows - rightRows) / 2;
  const middle = (rows - 1) / 2; // the company sits in the middle
  const several = v.people.length > 1 || Boolean(v.otherOwners);
  const rateText = (rates) => {
    if (!rates.length) return 'timpris saknas';
    const lo = Math.min(...rates);
    const hi = Math.max(...rates);
    return lo === hi ? `${fmt(lo)} kr/h` : `${fmt(lo)}–${fmt(hi)} kr/h`;
  };
  const personSub = (p) => {
    const net = Number.isFinite(p.netSumMonth) ? `${fmt(p.netSumMonth)} kr/mån` : 'fyll i uppgifter';
    return several && p.owner ? `${fmtShare(p.ownership)} % · ${net}` : net;
  };
  const structure = {
    columns: ['Inkomstkällor', 'Bolag', several ? 'Personer' : 'Person'],
    nodes: [
      ...v.assignments.map((a, i) => ({ id: `uppdrag-${a.id}`, type: 'source', name: a.name, sub: rateText(a.rates), col: 0, row: leftTop + i })),
      { id: 'bolag', type: 'bolag', name: 'Ditt aktiebolag', sub: `resultat ${fmt(v.profitAfterTax)}`, col: 1, row: middle },
      ...others.map((p, i) => ({ id: `annan-${p.id}`, type: 'source', name: p.otherEmployer, sub: `lön ${fmt(p.otherSalaryYear)}/år`, col: 0, row: leftTop + n + i })),
      ...v.people.map((p, i) => ({ id: `person-${p.id}`, type: 'person', name: p.name, sub: personSub(p), col: 2, row: peopleTop + i })),
      ...(v.otherOwners ? [{ id: 'ovriga', goto: 'bolag', type: 'person other', name: 'Övriga ägare', sub: `${fmtShare(v.otherOwners.share)} % · ingår inte`, col: 2, row: peopleTop + v.people.length }] : []),
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
      ...(v.otherOwners ? [{ goto: 'bolag', from: 'bolag', to: 'ovriga', label: `utdelning ${fmt(v.otherOwners.grossDividends)}`, title: 'Utdelning', offset: 0 }] : []),
    ],
  };
  // Several people: the company box grows so that every arrow leaving it starts at its own
  // height. The labels sit in the middle of the arrows and then do not overlap.
  if (several) {
    const out = structure.edges.filter((e) => e.from === 'bolag');
    out.forEach((e, k) => { e.fan = { k, count: out.length }; });
    structure.nodes.find((x) => x.id === 'bolag').h = Math.max(NODE_H, FAN_STEP * (out.length + 1));
  }
  return structure;
}

const COL_W = 290;
const NODE_W = 140;
const NODE_H = 50;
const ROW_H = 130;
const TOP = 30;
const FAN_STEP = 26; // distance between arrows leaving a tall company box

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderMap(structure, selected) {
  const { columns, nodes, edges } = structure;
  const W = COL_W * columns.length;
  const rows = Math.max(...nodes.map((n) => n.row)) + 1;
  // Boxes are centred on their row; a taller box (the company with several people) grows
  // both ways, and everything moves down if it would reach the column headings.
  const pos = Object.fromEntries(nodes.map((n) => {
    const h = n.h ?? NODE_H;
    return [n.id, { x: COL_W * n.col + (COL_W - NODE_W) / 2, y: TOP + n.row * ROW_H + (NODE_H - h) / 2, h }];
  }));
  const shift = Math.max(0, TOP - Math.min(...Object.values(pos).map((p) => p.y)));
  for (const p of Object.values(pos)) p.y += shift;
  let H = Math.max(TOP + shift + rows * ROW_H - 20, ...Object.values(pos).map((p) => p.y + p.h + 20));
  const bolag = pos.bolag;

  const edgeSvg = edges.map((e) => {
    const a = pos[e.from];
    const b = pos[e.to];
    const off = (e.offset ?? 0) * NODE_H;
    const x1 = a.x + NODE_W;
    const y1 = (e.fan ? a.y + a.h * (e.fan.k + 1) / (e.fan.count + 1) : a.y + a.h / 2 + off);
    const x2 = b.x - 8;
    const y2 = b.y + b.h / 2 + off;
    let mx = (x1 + x2) / 2;
    let d = `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
    // In the middle of the arrow (with one person, the three labels are pulled apart).
    let ly = (y1 + y2) / 2 + (e.fan ? 0 : (e.offset ?? 0) * 30);
    let lx = mx;
    if (e.enterFromBelow) {
      // Into the bottom of the target box, so it does not cross the arrows from the side.
      const bx = b.x + NODE_W / 2;
      const by = b.y + b.h + 8;
      d = `M${x1} ${y1} C ${bx} ${y1}, ${bx} ${y1}, ${bx} ${by}`;
      lx = (x1 + bx) / 2;
      ly = y1;
      if (bolag && y1 > bolag.y - 14 && y1 < bolag.y + bolag.h + 14) {
        // The company box is in the way: go under it.
        const lane = Math.max(bolag.y + bolag.h + 24, by + 16);
        d = `M${x1} ${y1} C ${x1 + 50} ${y1}, ${x1 + 50} ${lane}, ${x1 + 100} ${lane} L ${bx - 50} ${lane} C ${bx} ${lane}, ${bx} ${lane}, ${bx} ${by}`;
        lx = bolag.x + NODE_W / 2;
        ly = lane;
        H = Math.max(H, lane + 20);
      }
    }
    const lw = e.label.length * 6 + 14;
    return `<g class="edge ${e.goto === selected ? 'selected' : ''}" data-goto="${e.goto}" role="button" tabindex="0" aria-label="${esc(`${e.title}: ${e.label}`)}">
      <path class="line" d="${d}" marker-end="url(#arrowhead)" ${e.manual ? 'stroke-dasharray="4 4"' : ''}/><path class="hit" d="${d}"/>
      <rect x="${lx - lw / 2}" y="${ly - (e.fan ? 9 : 10)}" width="${lw}" height="${e.fan ? 18 : 20}" rx="9"/>
      <text x="${lx}" y="${ly + 4}" font-size="11" text-anchor="middle" fill="currentColor">${esc(e.label)}</text></g>`;
  }).join('');

  const nodeSvg = nodes.map((n) => {
    const p = pos[n.id];
    return `<g class="node ${n.type} ${(n.goto ?? n.id) === selected ? 'selected' : ''}" data-goto="${n.goto ?? n.id}" role="button" tabindex="0" aria-label="${esc(`${n.name}: ${n.sub}`)}">
      <rect x="${p.x}" y="${p.y}" width="${NODE_W}" height="${p.h}" rx="10"/>
      <text x="${p.x + 12}" y="${p.y + p.h / 2 - 4}" font-size="14" font-weight="600" fill="currentColor">${esc(n.name)}</text>
      <text x="${p.x + 12}" y="${p.y + p.h / 2 + 14}" font-size="12" fill="currentColor" opacity=".7">${esc(n.sub)}</text></g>`;
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
  const n = (id) => btn(node(id).goto ?? id, `t-${node(id).type}`, node(id).name, node(id).sub, selected === (node(id).goto ?? id));
  const e = (ed) => btn(ed.goto, 't-edge', ed.title, ed.label.replace(/^(lön|pension|utdelning) /, ''), selected === ed.goto);
  const assignmentRows = structure.edges.filter((ed) => ed.title === 'Fakturerat').map((ed) => n(ed.from) + e(ed)).join('');
  const people = structure.nodes.filter((x) => x.type.startsWith('person')).map((p) => {
    const edges = structure.edges.filter((ed) => ed.to === p.id);
    const fromCompany = edges.filter((ed) => ed.from === 'bolag');
    const other = edges.find((ed) => ed.title === 'Annan lön');
    return `${fromCompany.length ? `<div class="flow-trio" style="grid-template-columns: repeat(${fromCompany.length}, minmax(0, 1fr))">${fromCompany.map(e).join('')}</div>` : ''}${other ? n(other.from) + e(other) : ''}${n(p.id)}`;
  }).join('');
  return `<div class="flow-list">${assignmentRows}${n('bolag')}${people}</div>`;
}
