import { useState, useEffect } from "react";
import { Copy as CopyIcon, Check } from "lucide-react";
import { SEV } from "./Data";

export function Chip({ sev }) {
  const s = SEV[sev] || SEV.SAFE;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-mono font-semibold rounded-md border ${s.bg} ${s.color} ${s.border}`}>
      {sev}
    </span>
  );
}

export function Bar({ score }) {
  const pct = (score / 10) * 100;
  const c = score >= 8 ? "bg-red-600" : score >= 6 ? "bg-orange-600" : score >= 4 ? "bg-yellow-500" : score >= 2 ? "bg-amber-500" : "bg-green-600";
  const scoreTone = score >= 8 ? "CRITICAL" : score >= 6 ? "HIGH" : score >= 4 ? "MEDIUM" : "SAFE";

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 h-2 bg-sky-100 rounded-full overflow-hidden border border-sky-200">
        <div className={`h-full ${c} rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono font-bold w-7 text-right ${SEV[scoreTone].color}`}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

export function Copy({ text, size = "sm" }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg font-mono border transition-colors duration-200 ${ok ? 'text-green-700 bg-green-50 border-green-300' : 'text-ghost/70 hover:text-primary hover:bg-sky-50 border-sky-200'} ${size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"}`}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 2000);
      }}
    >
      {ok ? <Check size={14} /> : <CopyIcon size={14} />}
      {ok ? "Copied" : "Copy"}
    </button>
  );
}

export function CountUp({ n, duration = 1000 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let t0 = null;
    let req;
    const f = ts => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      setV(Math.floor(p * n));
      if (p < 1) req = requestAnimationFrame(f);
    };
    req = requestAnimationFrame(f);
    return () => cancelAnimationFrame(req);
  }, [n, duration]);
  return <>{v}</>;
}

export function GaugeArc({ value, size = 100 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (value / 100) * circ;
  const c = value >= 75 ? "#16A34A" : value >= 55 ? "#CA8A04" : value >= 35 ? "#EA580C" : "#DC2626";
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#DBEAFE" strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={7}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-700 ease-out" />
        <text x={size / 2} y={size / 2 + 2} textAnchor="middle" dominantBaseline="middle" fill={c} className="font-mono font-bold" fontSize={size / 4}>
          <CountUp n={value} />
        </text>
      </svg>
      <div className="text-[10px] uppercase font-bold text-ghost/50">Security Score</div>
    </div>
  );
}
