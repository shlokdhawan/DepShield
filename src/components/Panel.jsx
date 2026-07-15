import { useState, useRef, useEffect } from "react";
import { Copy, Chip } from "./UI";
import { SEV } from "./Data";
import {
  X, AlertTriangle, ShieldAlert, GitBranch, ArrowRight,
  Activity, Zap, GitPullRequest, ChevronUp
} from "lucide-react";
import gsap from "gsap";

function cleanMarkdown(text = "") {
  return text
    .replace(/#+\s*/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .trim();
}

function MaintainerBadge({ maint }) {
  const tone = maint === "Active" ? "bg-green-600" : maint === "Abandoned" ? "bg-red-600" : "bg-amber-500";
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-sky-200 text-ghost/70 rounded-lg text-sm font-mono">
      <span className={`w-2 h-2 rounded-full ${tone}`} />
      {maint}
    </span>
  );
}

export default function Panel({ dep, onClose }) {
  const [pr, setPr] = useState(false);
  const [showAllVulns, setShowAllVulns] = useState(false);
  const panelRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!dep) return;
    setShowAllVulns(false);
    setPr(false);
    const ctx = gsap.context(() => {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power2.out" });
      gsap.fromTo(panelRef.current, { x: 500, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: "power3.out", delay: 0.03 });
      gsap.from(".panel-item", {
        y: 12,
        opacity: 0,
        duration: 0.25,
        stagger: 0.04,
        ease: "power2.out",
        delay: 0.12
      });
    }, panelRef);

    return () => ctx.revert();
  }, [dep]);

  const handleClose = () => {
    const ctx = gsap.context(() => {
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.15 });
      gsap.to(panelRef.current, { x: 500, opacity: 0, duration: 0.22, ease: "power2.inOut", onComplete: onClose });
    });
    return () => ctx.revert();
  };

  if (!dep) return null;

  const col = SEV[dep.sev]?.hex || "#16A34A";
  const score = dep.score || 0;
  const pct = score / 10;
  const diff = `diff --git a/package.json b/package.json\n--- a/package.json\n+++ b/package.json\n@@ -12,4 +12,4 @@\n   "dependencies": {\n-    "${dep.name}": "^${dep.version}",\n+    "${dep.name}": "^${dep.fixv}",\n   }`;

  const breakageTone = dep.breakage_risk === 'HIGH'
    ? 'bg-red-50 border-red-200 text-red-700'
    : dep.breakage_risk === 'MEDIUM'
      ? 'bg-amber-50 border-amber-200 text-amber-700'
      : 'bg-green-50 border-green-200 text-green-700';

  return (
    <>
      <div
        ref={overlayRef}
        onClick={handleClose}
        className="fixed inset-0 bg-ghost/25 z-[98] transition-opacity"
      />
      <aside
        ref={panelRef}
        className="fixed top-0 right-0 w-full max-w-[500px] h-screen z-[99] bg-white border-l border-sky-200 overflow-y-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="sticky top-0 z-10 px-6 py-5 border-b border-sky-200 bg-white flex justify-between items-start">
          <div className="min-w-0 pr-4">
            <div className="text-2xl font-bold font-head text-ghost flex items-center gap-3 break-words">
              {dep.sev === 'CRITICAL' && <AlertTriangle size={24} color={col} />}
              {dep.name}
            </div>
            {dep.threat_intel && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm font-bold uppercase flex items-center gap-2">
                <ShieldAlert size={14} /> Known Threat Detected
              </div>
            )}
            <div className="text-sm text-ghost/60 mt-2 font-mono flex items-center gap-3 flex-wrap">
              v{dep.version} <ArrowRight size={14} className="text-ghost/40" /> <span className="text-primary font-bold">v{dep.fixv}</span>
            </div>
            <div className="mt-4 flex gap-2 flex-wrap items-center">
              <Chip sev={dep.sev} />
              <MaintainerBadge maint={dep.maint} />
              {dep.breakage_risk && (
                <span className={`inline-flex items-center gap-2 px-3 py-1 border rounded-lg text-sm font-mono font-bold ${breakageTone}`}>
                  {dep.breakage_risk === 'HIGH' ? 'High Breakage Risk' : dep.breakage_risk === 'MEDIUM' ? 'Medium Breakage Risk' : 'Low Breakage Risk'}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-ghost/50 hover:text-primary hover:bg-sky-50 rounded-lg transition-colors"
            title="Close panel"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {dep.cves?.length > 0 && (
            <div className="panel-item mb-8">
              <p className="text-sm font-bold uppercase text-red-700 mb-3 flex items-center gap-2">
                <ShieldAlert size={14} /> Known Exploits
              </p>
              <div className="flex flex-wrap gap-2">
                {dep.cves?.map(c => (
                  <span key={c} className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-1.5 text-sm font-mono">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="panel-item mb-8">
            <p className="text-sm font-bold uppercase text-ghost/50 mb-3 flex items-center gap-2">
              <Activity size={14} /> AI Analysis
            </p>
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-5 text-ghost/80 text-sm leading-relaxed font-body space-y-4 break-words">
              {showAllVulns && dep.vuln_details?.length > 1 ? (
                <>
                  {dep.vuln_details.map((v, i) => {
                    const text = cleanMarkdown(v.plain_desc || v.summary || "");
                    return (
                      <div key={i} className="mb-4 last:mb-0 break-words whitespace-pre-wrap">
                        <strong className="text-primary block mb-1 text-sm font-mono">{v.id}</strong>
                        {text}
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setShowAllVulns(false)}
                    className="text-primary hover:text-primary/80 font-bold text-sm uppercase block mt-4"
                  >
                    Show Less
                  </button>
                </>
              ) : (
                <div className="break-words whitespace-pre-wrap">
                  {dep.plain_desc || dep.desc}
                  {dep.vuln_details?.length > 1 && (
                    <button
                      className="text-primary font-bold hover:underline ml-2 whitespace-nowrap"
                      onClick={() => setShowAllVulns(true)}
                    >
                      (+{dep.vuln_details.length - 1} more)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="panel-item mb-8 bg-white border border-sky-200 rounded-lg p-6 flex items-center gap-6 relative overflow-hidden">
            <svg width={120} height={64} viewBox="0 0 200 108">
              <path d="M 20 98 A 80 80 0 0 1 180 98" fill="none" stroke="#DBEAFE" strokeWidth={14} strokeLinecap="round" />
              <path d="M 20 98 A 80 80 0 0 1 180 98" fill="none" stroke={col} strokeWidth={14} strokeLinecap="round"
                strokeDasharray={`${pct * 251.3} 251.3`} className="transition-all duration-700 ease-out" />
              <text x={100} y={78} textAnchor="middle" fill={col} fontSize={36} fontFamily="Fira Code" fontWeight="700">{score.toFixed(1)}</text>
            </svg>
            <div>
              <div className="text-3xl font-bold font-head" style={{ color: col }}>
                {dep.sev}
              </div>
              <div className="text-ghost/50 text-sm mt-1 uppercase font-bold">CVSS Base Score</div>
              <div className="text-ghost/60 text-sm mt-2 font-mono flex items-center gap-2 flex-wrap">
                <span className="w-1.5 h-1.5 rounded-full bg-ghost/40" />
                {dep.vulns} CVE{dep.vulns !== 1 ? "s" : ""} / {dep.updated}
              </div>
              {dep.attack_type && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-sky-50 border border-sky-200 rounded text-sm text-ghost/60 uppercase font-bold">
                    {dep.attack_type}
                  </span>
                  {dep.urgency && (
                    <span className="px-2 py-1 bg-primary/10 border border-primary/20 rounded text-sm text-primary uppercase font-bold">
                      {dep.urgency}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="panel-item mb-8">
            <p className="text-sm font-bold uppercase text-ghost/50 mb-3 flex items-center gap-2">
              <GitBranch size={14} /> Origin Trace
            </p>
            <div className="flex items-center flex-wrap gap-2 font-mono text-sm">
              {dep.origin?.map((part, i) => {
                const isLast = i === dep.origin.length - 1;
                return (
                  <span key={i} className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 ${isLast
                        ? "bg-red-50 border-red-200 text-red-700"
                        : "bg-sky-50 border-sky-200 text-primary"
                      }`}>
                      {isLast && <Zap size={12} className="text-red-700" />}
                      {part}
                    </span>
                    {!isLast && <ArrowRight size={14} className="text-ghost/35 mx-1" />}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="panel-item mb-8">
            <p className="text-sm font-bold uppercase text-ghost/50 mb-3 flex items-center gap-2">
              <Zap size={14} /> Smart Advisor
            </p>
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-5 text-ghost/80 text-sm leading-relaxed font-body space-y-4">
              {dep.reco ? (
                <div className="whitespace-pre-wrap">{dep.reco}</div>
              ) : (
                <div className="text-ghost/50 italic">No specific remediation advice available.</div>
              )}

              {dep.usage_info && (
                <div className="pt-3 border-t border-sky-200">
                  <strong className="text-ghost block mb-1">Impact Analysis:</strong>
                  <span className="text-primary font-mono bg-white border border-sky-200 px-2 py-1 rounded text-sm">{dep.usage_info}</span>
                </div>
              )}
            </div>
          </div>

          {dep.score_breakdown && (
            <div className="panel-item mb-8">
              <p className="text-sm font-bold uppercase text-ghost/50 mb-3 flex items-center gap-2">
                <Activity size={14} /> Risk Factor Analysis
              </p>
              <div className="bg-white border border-sky-200 rounded-lg p-4 space-y-2.5">
                {Object.entries(dep.score_breakdown).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center text-sm font-mono gap-4">
                    <span className="text-ghost/55 uppercase">{key.replace(/_/g, " ")}</span>
                    <span className="text-primary font-bold">{typeof val === "number" ? (val > 1 ? `x${val.toFixed(2)}` : val.toFixed(2)) : val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dep.fix && (
            <div className="panel-item mb-8">
              <p className="text-sm font-bold uppercase text-green-700 mb-3 flex items-center gap-2">
                <Zap size={14} /> Recommended Fix
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex justify-between items-center gap-4">
                <code className="text-green-700 text-sm break-all font-mono">{dep.fix}</code>
                <Copy text={dep.fix} />
              </div>
            </div>
          )}

          {dep.alts?.length > 0 && (
            <div className="panel-item mb-8">
              <p className="text-sm font-bold uppercase text-ghost/50 mb-3 flex items-center gap-2">
                <ArrowRight size={14} /> Safe Alternatives
              </p>
              {dep.alts?.map((a, i) => (
                <div key={i} className="bg-white border border-sky-200 rounded-lg p-4 mb-3">
                  <div className="text-ghost/90 text-base font-bold mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-ghost/40" /> {a.name}
                  </div>
                  <div className="bg-sky-50 border border-sky-200 rounded-lg px-4 py-3 flex justify-between items-center gap-4">
                    <code className="text-ghost/70 text-sm break-all font-mono">{a.cmd}</code>
                    <Copy text={a.cmd} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {dep.fix && (
            <div className="panel-item mt-10">
              <button
                className="w-full btn-vapor-primary py-4 text-[15px] group flex items-center justify-center gap-3"
                onClick={() => setPr(v => !v)}
              >
                {!pr ? (
                  <><GitPullRequest size={16} /> Generate Pull Request</>
                ) : (
                  <><ChevronUp size={16} /> Hide PR Diff</>
                )}
              </button>

              {pr && (
                <div className="mt-4 bg-white border border-sky-200 rounded-lg overflow-hidden animate-fade-up">
                  <div className="px-5 py-3 border-b border-sky-200 flex justify-between items-center bg-sky-50">
                    <span className="text-ghost/55 text-sm font-mono">patch.diff</span>
                    <Copy text={diff} />
                  </div>
                  <pre className="p-5 m-0 text-sm text-ghost/75 overflow-x-auto leading-loose whitespace-pre-wrap font-mono relative">
                    {diff}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
