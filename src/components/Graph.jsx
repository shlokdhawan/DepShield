import { useState, useEffect, useRef } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Search, X } from "lucide-react";
import { SEV } from "./Data";

export default function Graph({ deps, onPick }) {
  const [pos, setPos] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hov, setHov] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState(null);

  const dragStart = useRef(null);
  const posR = useRef([]);
  const velR = useRef([]);

  const W = 1200, H = 700;
  const n = deps.length;
  const R = n > 300 ? 8 : n > 150 ? 11 : n > 60 ? 14 : n > 25 ? 17 : 20;
  const gap = R * 0.8;
  const minDist = (R * 2) + gap;

  useEffect(() => {
    if (!n) return;

    const cx = W / 2, cy = H / 2;
    const radiusX = W / 2 - R - 20;
    const radiusY = H / 2 - R - 20;

    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const initPos = new Array(n);

    for (let i = 0; i < n; i++) {
      const theta = 2 * Math.PI * i / goldenRatio;
      const phi = Math.acos(1 - (i + 0.5) / n);
      const phiHemi = phi * 0.5;
      const px = Math.sin(phiHemi) * Math.cos(theta);
      const py = Math.sin(phiHemi) * Math.sin(theta);
      initPos[i] = { x: cx + px * radiusX, y: cy + py * radiusY };
    }

    posR.current = initPos;
    velR.current = deps.map(() => ({ vx: 0, vy: 0 }));

    const repStr = minDist * minDist * 1.5;
    const totalFrames = Math.min(150, 50 + n);
    const p = posR.current, v = velR.current;

    for (let frame = 0; frame < totalFrames; frame++) {
      const cooling = Math.max(0.15, 1 - frame / totalFrames);

      for (let i = 0; i < n; i++) {
        let fx = 0, fy = 0;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const dx = p[i].x - p[j].x, dy = p[i].y - p[j].y;
          const d2 = dx * dx + dy * dy;
          const d = Math.sqrt(d2) || 0.5;
          if (d < minDist * 3) {
            const force = repStr / Math.max(d2, minDist * minDist * 0.1);
            fx += (dx / d) * force;
            fy += (dy / d) * force;
          }
        }
        fx += (cx - p[i].x) * 0.001;
        fy += (cy - p[i].y) * 0.001;

        const ex = (p[i].x - cx) / radiusX;
        const ey = (p[i].y - cy) / radiusY;
        const ed = ex * ex + ey * ey;
        if (ed > 0.85) {
          const pushBack = (ed - 0.85) * 8;
          fx -= ex * pushBack * radiusX;
          fy -= ey * pushBack * radiusY;
        }

        v[i].vx = (v[i].vx * 0.6 + fx * cooling);
        v[i].vy = (v[i].vy * 0.6 + fy * cooling);

        const spd = Math.sqrt(v[i].vx ** 2 + v[i].vy ** 2);
        if (spd > 4) { v[i].vx *= 4 / spd; v[i].vy *= 4 / spd; }

        p[i].x += v[i].vx;
        p[i].y += v[i].vy;

        p[i].x = Math.max(R + 5, Math.min(W - R - 5, p[i].x));
        p[i].y = Math.max(R + 5, Math.min(H - R - 5, p[i].y));
      }
    }

    setPos(p.map(pt => ({ ...pt })));
    setZoom(1);
    setPan({ x: 0, y: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps]);

  const onWheel = e => { e.preventDefault(); setZoom(z => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001))); };
  const onMD = e => { setDragging(true); dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; };
  const onMM = e => { if (dragging && dragStart.current) setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }); };
  const onMU = () => setDragging(false);

  const hovDep = hov !== null ? deps.find(d => d.id === hov) : null;
  const hovIdx = hov !== null ? deps.findIndex(d => d.id === hov) : -1;
  const maxChars = Math.max(0, Math.floor((R * 2 - 4) / 5));

  const isMatch = (d) => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase());
    const matchSev = !sevFilter || d.sev === sevFilter;
    return matchSearch && matchSev;
  };
  const matchCount = deps.filter(isMatch).length;

  const toolbarButton = "inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-sky-200 hover:bg-sky-50 text-ghost text-xs font-semibold transition-colors";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button className={toolbarButton} onClick={() => setZoom(z => Math.min(z + 0.2, 3))} title="Zoom in">
            <ZoomIn size={14} /> Zoom In
          </button>
          <button className={toolbarButton} onClick={() => setZoom(z => Math.max(z - 0.2, 0.3))} title="Zoom out">
            <ZoomOut size={14} /> Zoom Out
          </button>
          <button className={toolbarButton} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset view">
            <RotateCcw size={14} /> Reset
          </button>
          <span className="text-xs font-mono text-ghost/50 px-2">{Math.round(zoom * 100)}%</span>

          <div className="sm:ml-auto relative flex items-center w-full sm:w-auto">
            <Search className="absolute left-3 text-ghost/40" size={14} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search package..."
              className="pl-9 pr-9 py-2 w-full sm:w-72 rounded-lg bg-white border border-sky-200 text-ghost font-mono text-xs focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors placeholder:text-ghost/40"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 text-ghost/40 hover:text-primary transition-colors" title="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setSevFilter(null)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors border ${!sevFilter ? 'bg-primary text-white border-primary' : 'bg-white text-ghost/60 border-sky-200 hover:text-primary hover:bg-sky-50'}`}>
            All <span className="font-mono text-[10px] opacity-80">({n})</span>
          </button>
          {["CRITICAL", "HIGH", "MEDIUM", "LOW", "SAFE"].map(sev => {
            const active = sevFilter === sev;
            const cnt = deps.filter(d => d.sev === sev).length;
            const details = SEV[sev];
            const hex = details.hex;

            return (
              <button key={sev} onClick={() => setSevFilter(active ? null : sev)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors border ${active ? 'bg-white' : 'bg-white text-ghost/60 border-sky-200 hover:text-primary hover:bg-sky-50'}`}
                style={active ? { color: hex, borderColor: hex, backgroundColor: `${hex}10` } : undefined}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hex }} />
                {sev.charAt(0) + sev.slice(1).toLowerCase()}
                <span className="font-mono text-[10px] opacity-80">({cnt})</span>
              </button>
            );
          })}
          {(search || sevFilter) && <span className="text-xs font-mono text-ghost/50 ml-1">{matchCount} of {n} matched</span>}
        </div>
      </div>

      <div
        className="border border-sky-200 rounded-lg overflow-hidden bg-white relative"
        onWheel={onWheel} onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ cursor: dragging ? "grabbing" : "grab" }} onClick={() => setHov(null)}>
          <defs>
            {deps.map((d, i) => pos[i] ? (
              <clipPath key={`cp${d.id}`} id={`clip-${d.id}`}>
                <circle cx={pos[i].x} cy={pos[i].y} r={R - 2} />
              </clipPath>
            ) : null)}
          </defs>

          <rect width={W} height={H} fill="#FFFFFF" />

          {[...Array(12)].map((_, i) => <line key={`h${i}`} x1={0} y1={(i / 11) * H} x2={W} y2={(i / 11) * H} stroke="#E0F2FE" strokeWidth={1} />)}
          {[...Array(20)].map((_, i) => <line key={`v${i}`} x1={(i / 19) * W} y1={0} x2={(i / 19) * W} y2={H} stroke="#E0F2FE" strokeWidth={1} />)}

          <g transform={`translate(${W / 2 * (1 - zoom) + pan.x * 0.5},${H / 2 * (1 - zoom) + pan.y * 0.5}) scale(${zoom})`}>
            {deps.map((d, i) => {
              if (!pos[i]) return null;
              const next = deps[i + 1];
              if (!next) return null;
              const ni = i + 1;
              if (!pos[ni]) return null;
              const isActive = hov === d.id || hov === next.id;
              return <line key={`e${d.id}`} x1={pos[i].x} y1={pos[i].y} x2={pos[ni].x} y2={pos[ni].y}
                stroke={isActive ? "#0369A1" : "#BFDBFE"}
                strokeOpacity={isActive ? 0.7 : 0.45}
                strokeWidth={isActive ? 1.8 : 0.8}
                className="transition-all duration-200" />;
            })}

            {deps.map((d, i) => {
              if (!pos[i]) return null;
              const { x, y } = pos[i], isH = hov === d.id;
              const matched = isMatch(d);
              const cr = isH ? R + 4 : R;
              const isSearchHit = search && d.name.toLowerCase().includes(search.toLowerCase());
              const col = SEV[d.sev]?.hex || "#16A34A";

              return (
                <g key={d.id} onClick={e => { e.stopPropagation(); onPick(d); }}
                  onMouseEnter={() => setHov(d.id)} onMouseLeave={() => setHov(null)}
                  className={`cursor-pointer transition-opacity duration-200 ${matched ? 'opacity-100' : 'opacity-20'}`}>
                  {isH && <circle cx={x} cy={y} r={R + 8} fill="none" stroke={col} strokeWidth={1.5} strokeOpacity={0.35} />}
                  <circle cx={x} cy={y} r={cr}
                    fill={`${col}18`}
                    stroke={col} strokeWidth={isH ? 2.5 : isSearchHit ? 2 : 1.5}
                    className="transition-all duration-200" />

                  {maxChars >= 2 && (
                    <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fill={col}
                      fontSize={Math.max(5, Math.min(8, R * 0.7))} fontFamily="Fira Code" fontWeight="700"
                      clipPath={`url(#clip-${d.id})`}
                      style={{ pointerEvents: "none" }}>
                      {d.name.length > maxChars ? d.name.slice(0, maxChars) : d.name}
                    </text>
                  )}
                </g>
              );
            })}

            {hov !== null && hovIdx >= 0 && pos[hovIdx] && (() => {
              const { x, y } = pos[hovIdx], dep = hovDep;
              const col = SEV[dep.sev]?.hex || "#16A34A";
              const nameLen = dep.name.length;
              const tw = Math.max(180, Math.min(300, nameLen * 8.5 + 40)), th = 85;
              const tx = x + R + 10 + tw > W ? x - tw - R - 5 : x + R + 12;
              const tyRaw = y - th / 2;
              const ty = Math.max(10, Math.min(H - th - 10, tyRaw));
              const displayName = dep.name.length > 30 ? dep.name.slice(0, 28) + "..." : dep.name;

              return (
                <g style={{ pointerEvents: "none" }}>
                  <rect x={tx} y={ty} width={tw} height={th} rx={8} fill="#FFFFFF" stroke={col} strokeWidth={1.5} />
                  <rect x={tx + 1.5} y={ty + 1.5} width={tw - 3} height={th - 3} rx={6.5} fill={`${col}08`} />
                  <text x={tx + 16} y={ty + 26} fill={col} fontSize={14} fontFamily="Fira Code" fontWeight="700">{displayName}</text>
                  <text x={tx + 16} y={ty + 48} fill="#0C4A6E" fontSize={12} fontFamily="Fira Code" opacity={0.65}>v{dep.version}</text>
                  <text x={tx + 16} y={ty + 68} fill="#0C4A6E" fontSize={12} fontFamily="Fira Code" opacity={0.8}>Score: {dep.score.toFixed(1)} &middot; {dep.cluster_label || dep.sev}{dep.override_applied ? " (override)" : ""}</text>
                  <circle cx={tx + tw - 24} cy={ty + 23} r={4} fill={col} />
                </g>
              );
            })()}
          </g>
        </svg>
      </div>
    </div>
  );
}
