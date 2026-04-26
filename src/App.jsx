import { useState, useEffect } from "react";
import { Copy, CountUp, GaugeArc, Chip, Bar } from "./components/UI";
import { SEV } from "./components/Data";
import Graph from "./components/Graph";
import Panel from "./components/Panel";
import {
  Shield, ShieldAlert, CheckCircle2, ChevronRight, Activity, Zap, Info, LayoutDashboard,
  Network, AlertTriangle, Workflow, Moon, Sun, ArrowRight, Github, PackageOpen, Download,
  Monitor, ServerCog, Check
} from "lucide-react";

// ─── NEW: GitHub Auth Integration ────────────────────────────────────────────
import { useAuth } from "./contexts/AuthContext";
import GitHubLoginButton from "./components/GitHubLoginButton";
import UserMenu from "./components/UserMenu";
import MonitoringDashboard from "./components/MonitoringDashboard";
import { API_BASE } from "./config/api";
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [phase, setPhase] = useState("input"); // input | pipeline | skeletons | main | monitoring
  const [pStep, setPStep] = useState(-1);

  // ─── NEW: Auth state from context ──────────────────────────────────────────
  const { user, isAuthenticated, login: authLogin, loading: authLoading } = useAuth();
  const [tab, setTab] = useState("dashboard");
  const [inputTab, setInputTab] = useState("url"); // url | file
  const [url, setUrl] = useState("");

  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState("");
  const [sel, setSel] = useState(null);
  const [filt, setFilt] = useState("All");
  const [sCol, setSCol] = useState("score");
  const [sDir, setSDir] = useState("desc");

  // Custom Cursor Logic
  useEffect(() => {
    const cursor = document.createElement("div");
    cursor.id = "custom-cursor";
    document.body.appendChild(cursor);

    const moveCursor = (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    };

    const handleHover = (e) => {
      const target = e.target.closest('button, a, input, [role="button"], tr');
      if (target) cursor.classList.add('hover');
      else cursor.classList.remove('hover');
    };

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('mouseover', handleHover);

    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mouseover', handleHover);
      if (document.getElementById("custom-cursor")) {
        document.body.removeChild(cursor);
      }
    };
  }, []);

  // ─── NEW: Detect OAuth callback token in URL ──────────────────────────────
  // After GitHub OAuth, the backend redirects here with ?auth_token=<jwt>
  // We extract it, store it via AuthContext, and clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("auth_token");
    if (token) {
      authLogin(token).then(() => {
        // Clean the URL so the token isn't visible/bookmarkable
        window.history.replaceState({}, "", window.location.pathname);
        setPhase("monitoring");
      });
    }
  }, [authLogin]);
  // ──────────────────────────────────────────────────────────────────────────

  const TABS = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={14} /> },
    { id: "graph", label: "Topology", icon: <Network size={14} /> },
    { id: "vulns", label: "Security Ledger", icon: <AlertTriangle size={14} /> },
    { id: "fixes", label: "Action Plan", icon: <Workflow size={14} /> },
  ];

  const PIPE = [
    "Initializing secure analysis container...",
    "Resolving complete dependency graph...",
    "Querying OSV vulnerability endpoints...",
    "Evaluating NPM registry maintainer metrics...",
    "Executing contextual impact analysis...",
    "Finalizing critical security vectors..."
  ];

  const API = API_BASE;

  const runPipeline = async (backendPromise) => {
    setPhase("pipeline");
    setPStep(-1);
    setScanResult(null);
    setScanError("");
    setTab("dashboard");

    let isBackendDone = false;
    const wrappedPromise = backendPromise.then(res => {
      isBackendDone = true;
      return res;
    }).catch(err => {
      isBackendDone = true;
      throw err;
    });

    for (let i = 0; i < PIPE.length - 1; i++) {
      setPStep(i);
      await new Promise(r => setTimeout(r, 600)); // 600ms per step
    }
    setPStep(PIPE.length - 1);
    await new Promise(r => setTimeout(r, 500));

    if (!isBackendDone) {
      setPhase("skeletons");
    }

    try {
      const result = await wrappedPromise;
      if (result.error) throw new Error(result.error);
      if (Array.isArray(result)) {
        setScanResult(result);
        setPhase("main");
      } else {
        throw new Error("Unexpected response from server.");
      }
    } catch (err) {
      setScanError(err.message);
      setPhase("input");
    }
  };

  const startURLScan = () => {
    if (!url.trim()) return;
    const p = fetch(`${API}/api/scan`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl: url }),
    }).then(async r => {
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${r.status}`);
      }
      return r.json();
    });
    runPipeline(p);
  };

  const startFileScan = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      let content;
      try { content = JSON.parse(e.target.result); } catch { setScanError("Invalid JSON file. Please verify format."); setPhase("input"); return; }
      const p = fetch(`${API}/api/scan-file`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content }),
      }).then(async r => {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with ${r.status}`);
        }
        return r.json();
      });
      runPipeline(p);
    };
    reader.readAsText(file);
  };

  const activeDeps = scanResult || [];
  const crit = activeDeps.filter(d => d.sev === "CRITICAL").length;
  const high = activeDeps.filter(d => d.sev === "HIGH").length;
  const med = activeDeps.filter(d => d.sev === "MEDIUM").length;
  const low = activeDeps.filter(d => d.sev === "LOW").length;
  const upg = activeDeps.filter(d => d.version !== d.fixv && d.sev !== "SAFE").length;
  const aband = activeDeps.filter(d => d.maint === "Abandoned").length;

  const total = activeDeps.length || 1;
  const safeCount = total - crit - high - med - low;
  const healthScore = (safeCount * 100 + low * 50 + med * 15 + high * 5 + crit * 0) / total;
  const sevPenalty = Math.min(50, crit * 15 + high * 5);
  const risk = Math.max(0, Math.min(100, Math.round(healthScore - sevPenalty)));
  const grade = risk >= 90 ? "A" : risk >= 75 ? "B" : risk >= 55 ? "C" : risk >= 35 ? "D" : "F";
  const gc = risk >= 75 ? "#10B981" : risk >= 55 ? "#F59E0B" : risk >= 35 ? "#F97316" : "#EF4444";

  const rows = [...activeDeps]
    .filter(d => filt === "All" || d.sev === filt)
    .sort((a, b) => { let av = a[sCol], bv = b[sCol]; if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); } return sDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1); });

  const doSort = c => { if (sCol === c) setSDir(d => d === "asc" ? "desc" : "asc"); else { setSCol(c); setSDir("desc"); } };
  const fixes = activeDeps.filter(d => d.sev !== "SAFE" && d.fix).sort((a, b) => b.score - a.score);

  const Stat = ({ label, val, color, sub }) => (
    <div className="glass-panel rounded-2xl p-6 relative flex flex-col justify-between min-h-[140px] transform transition-transform hover:-translate-y-1">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-ghost/60 mb-1">{label}</p>
        <div className="text-4xl font-bold tracking-tight mt-1" style={{ color }}>
          {phase === "main" ? <CountUp n={val} /> : val}
        </div>
      </div>
      {sub && <p className="text-sm border-t border-white/5 pt-3 mt-4 text-ghost/50">{sub}</p>}
    </div>
  );

  return (
    <>
      <div className="apple-aura" />

      {/* ── HEADER ── */}
      <header className="fixed top-0 left-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between transition-all">
        <div onClick={() => { setPhase("input"); setScanError(""); }} className="flex items-center gap-3 cursor-pointer group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-background shadow-lg shadow-primary/30">
            <Shield size={18} />
          </div>
          <span className="font-bold text-lg tracking-tight">DepShield</span>
        </div>

        {phase === "main" && (
          <nav className="hidden md:flex items-center gap-2">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${tab === t.id ? "bg-primary/10 text-primary border border-primary/20" : "text-ghost/60 hover:text-ghost hover:bg-white/5 border border-transparent"}`}>
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-4">
          {phase === "main" && (
            <div className="hidden lg:flex items-center gap-4 mr-2">
              <span className="text-xs text-ghost/40 font-mono tracking-wide truncate max-w-[150px]">{url || "scanned project"}</span>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-400/10 border border-teal-400/20 text-teal-400 text-xs font-mono tracking-wide relative overflow-hidden">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_5px_currentColor] animate-pulse" />
                <span className="font-semibold mix-blend-screen text-[10px] uppercase">System Operational</span>
              </span>
            </div>
          )}

          {/* ─── NEW: User menu (when authenticated) ─── */}
          {isAuthenticated && (
            <UserMenu
              onNavigateMonitoring={() => {
                setPhase("monitoring");
                setTab("dashboard");
              }}
            />
          )}
        </div >
      </header >

      <main className="min-h-screen pt-28 pb-20 px-6 sm:px-12 relative z-10 max-w-[1400px] mx-auto">

        {/* ── ERROR TOAST ── */}
        {scanError && (
          <div className="mb-8 w-full max-w-2xl mx-auto bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 text-sm flex items-start flex-col sm:flex-row gap-4 shadow-lg animate-[pulse-op_2s]">
            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="block font-bold mb-1">Scan Failed</span>
              <span className="text-red-400/80">{scanError}</span>
            </div>
            <button onClick={() => setScanError("")} className="text-red-400 hover:text-red-300 text-sm uppercase font-bold tracking-wider">Dismiss</button>
          </div>
        )}

        {/* ── INPUT PHASE ── */}
        {phase === "input" && (
          <div className="max-w-xl mx-auto pt-16 animate-in fade-in duration-500">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Dependancy Risk <span className="text-primary">Analyzer</span>
              </h1>
              <p className="text-ghost/60 text-base leading-relaxed">
                Seamlessly evaluate Node.js ecosystems for abandoned supply chains and zero-day vulnerabilities.
              </p>
            </div>

            <div className="glass-panel p-2 rounded-[2rem]">
              <div className="p-6">
                <div className="flex gap-2 mb-6 bg-background rounded-xl p-1.5 border border-white/5">
                  {[{ id: "url", label: "GitHub URL", icon: <Github size={16} /> }, { id: "file", label: "File Upload", icon: <PackageOpen size={16} /> }].map(t => (
                    <button key={t.id} onClick={() => setInputTab(t.id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${inputTab === t.id ? "bg-surface shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-white/5 text-ghost" : "text-ghost/40 hover:text-ghost/80"
                        }`}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                {inputTab === "url" ? (
                  <div className="flex flex-col gap-4">
                    <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://github.com/owner/repository"
                      className="w-full bg-background border border-white/10 rounded-xl px-4 py-3.5 text-ghost font-mono text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-ghost/20 outline-none" />
                    <button onClick={startURLScan} className="btn-vapor-primary text-base py-3.5 mt-2 w-full">
                      Initialize Scan
                    </button>
                  </div>
                ) : (
                  <label onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) startFileScan(file); }}
                    onDragOver={e => e.preventDefault()}
                    className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 hover:border-primary/50 hover:bg-primary/5 rounded-xl p-12 cursor-pointer transition-all">
                    <div className="w-14 h-14 rounded-xl bg-background border border-white/5 flex items-center justify-center mb-4 shadow-sm text-primary">
                      <Download size={20} />
                    </div>
                    <div className="font-semibold text-sm mb-1 tracking-wide">Drop package.json here</div>
                    <div className="text-ghost/40 text-sm">or click to browse local files</div>
                    <input type="file" accept=".json" className="hidden" onClick={e => { e.target.value = null; }} onChange={(e) => { const file = e.target.files[0]; if (file) startFileScan(file); }} />
                  </label>
                )}
              </div>
            </div>

            {/* ─── NEW: GitHub Login CTA ─── */}
            <GitHubLoginButton />
          </div>
        )}

        {/* ── PIPELINE ANIMATION PHASE ── */}
        {phase === "pipeline" && (
          <div className="max-w-xl mx-auto pt-24 text-left animate-in fade-in duration-300">
            <h2 className="text-3xl font-bold tracking-tight mb-8 text-center flex items-center justify-center gap-4">
              <ServerCog className="text-primary animate-[spin_4s_linear_infinite]" size={28} />
              System Core Initializing
            </h2>
            <div className="glass-panel p-6 rounded-2xl flex flex-col gap-5 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] pointer-events-none rounded-full" />
              {PIPE.map((txt, i) => (
                <div key={i} className={`flex items-center gap-4 transition-all duration-500 transform ${i <= pStep ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                  {i < pStep ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Check size={14} className="stroke-[3]" />
                    </div>
                  ) : i === pStep ? (
                    <div className="w-6 h-6 rounded-full border-[3px] border-primary border-t-transparent animate-spin shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full border border-white/10 shrink-0 bg-white/5" />
                  )}
                  <span className={`text-sm font-medium ${i < pStep ? 'text-ghost text-emerald-400' : i === pStep ? 'text-ghost' : 'text-ghost/30'}`}>{txt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LOADING PHASE (SKELETONS) ── */}
        {phase === "skeletons" && (
          <div className="max-w-7xl mx-auto pt-6 w-full animate-pulse">
            <div className="flex items-center gap-4 mb-8 w-full glass-panel rounded-2xl p-6 relative overflow-hidden">
              <ServerCog size={24} className="text-primary/50 animate-bounce" />
              <div>
                <div className="font-bold tracking-tight text-lg text-ghost/80">Cross-referencing global vulnerability databases</div>
                <div className="text-sm text-ghost/50 mt-1">Downloading metadata components...</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="glass-panel rounded-2xl p-6 h-[140px] flex flex-col justify-between">
                  <div className="w-1/2 h-3 bg-white/10 rounded" />
                  <div className="w-16 h-10 bg-white/5 rounded-md mt-4" />
                  <div className="w-3/4 h-2 bg-white/10 rounded mt-auto" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-3 glass-panel rounded-2xl p-8 h-[380px] flex flex-col items-center justify-center gap-6">
                <div className="w-32 h-32 rounded-full border-8 border-white/5" />
                <div className="w-16 h-12 bg-white/5 rounded" />
              </div>
              <div className="lg:col-span-6 glass-panel rounded-2xl p-6 h-[380px]">
                <div className="w-1/3 h-4 bg-white/10 rounded mb-8" />
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => <div key={i} className="w-full h-12 bg-white/10 rounded-lg" />)}
                </div>
              </div>
              <div className="lg:col-span-3 glass-panel rounded-2xl p-6 h-[380px]">
                <div className="w-1/2 h-4 bg-white/10 rounded mb-8" />
                <div className="space-y-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i}>
                      <div className="w-full justify-between flex mb-3"><div className="w-16 h-4 bg-white/5 rounded" /><div className="w-6 h-4 bg-white/5 rounded" /></div>
                      <div className="w-full h-2 bg-white/10 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MAIN VIEWS ── */}
        {phase === "main" && scanResult && (
          <div className="max-w-7xl mx-auto pt-6 animate-in fade-in duration-500">
            {/* DASHBOARD */}
            {tab === "dashboard" && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Stat label="Mapped Dependencies" val={activeDeps.length} color="#7B61FF" sub="Total packages tracked" />
                  <Stat label="Critical Threats" val={crit} color="#EF4444" sub="Immediate patches required" />
                  <Stat label="Outdated Versions" val={upg} color="#F59E0B" sub="Updates available" />
                  <Stat label="Abandoned Libraries" val={aband} color="#F97316" sub="Lacking active maintainers" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Grade Card */}
                  <div className="lg:col-span-3 glass-panel rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                    <GaugeArc value={risk} size={140} />
                    <div className="mt-8 font-bold text-7xl leading-none" style={{ color: gc }}>{grade}</div>
                    <div className="mt-4 text-sm font-bold uppercase tracking-widest text-ghost/40">Audit Grade</div>
                  </div>

                  {/* Critical List */}
                  <div className="lg:col-span-6 glass-panel rounded-2xl overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Critical Threat Vector</h3>
                      <Chip sev="CRITICAL" />
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[400px] divide-y divide-white/5">
                      {activeDeps.filter(d => d.sev === "CRITICAL").map(d => (
                        <div key={d.id} onClick={() => setSel(d)} className="p-4 flex justify-between items-center hover:bg-white/5 cursor-pointer transition-colors group">
                          <div>
                            <div className="font-bold text-sm flex items-center gap-2">
                              {d.name} <span className="text-sm font-mono text-ghost/40 font-normal">v{d.version}</span>
                            </div>
                            <div className="text-sm text-red-400 font-mono mt-1 flex items-center gap-1.5">
                              <ShieldAlert size={12} /> {d.cves.join(" · ")}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-xl text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.2)]">{d.score}</div>
                            <div className="text-sm text-ghost/40 font-mono mt-0.5">CVSS</div>
                          </div>
                        </div>
                      ))}
                      {activeDeps.filter(d => d.sev === "CRITICAL").length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-ghost/40">
                          <CheckCircle2 size={32} className="text-emerald-500 mb-3 opacity-80" />
                          <div className="text-sm">No critical vulnerabilities detected.</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Severity Breakdown */}
                  <div className="lg:col-span-3 glass-panel rounded-2xl p-6 flex flex-col justify-center">
                    <h3 className="text-sm font-semibold mb-6">Severity Distribution</h3>
                    <div className="flex flex-col gap-4">
                      {["CRITICAL", "HIGH", "MEDIUM", "LOW", "SAFE"].map(s => {
                        const cnt = activeDeps.filter(d => d.sev === s).length;
                        const pct = activeDeps.length ? (cnt / activeDeps.length) * 100 : 0;
                        const c = SEV[s];
                        return (
                          <div key={s}>
                            <div className="flex justify-between items-center mb-2">
                              <Chip sev={s} />
                              <span className="text-sm font-mono font-medium text-ghost/60">{cnt}</span>
                            </div>
                            <div className="bg-background rounded-full h-1 overflow-hidden border border-white/5">
                              <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%`, backgroundColor: c.hex }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Abandoned Libs Section */}
                <div className="glass-panel rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Flagged Maintenance Issues</h3>
                  </div>
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {activeDeps.filter(d => d.maint !== "Active").map(d => (
                      <div key={d.id} onClick={() => setSel(d)}
                        className={`bg-background border rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 ${d.maint === "Abandoned" ? "border-amber-500/30 hover:border-amber-500/60" : "border-white/5 hover:border-white/20"}`}>
                        <div className="text-sm font-semibold truncate mb-1">{d.name}</div>
                        <div className="text-sm text-ghost/40 font-mono mb-3">v{d.version}</div>
                        <div className="flex justify-between items-center mt-2">
                          <Chip sev={d.sev} />
                          <span className={`text-sm tracking-wider font-bold ${d.maint === "Abandoned" ? "text-amber-500" : "text-ghost/50"}`}>{d.maint}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* GRAPH */}
            {tab === "graph" && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight mb-1">Architecture Topology</h2>
                  <p className="text-sm text-ghost/60">Node tree structure map showing origin lineages.</p>
                </div>
                <Graph deps={activeDeps} onPick={setSel} />
              </div>
            )}

            {/* VULNS */}
            {tab === "vulns" && (
              <div>
                <div className="mb-6 flex justify-between items-end flex-wrap gap-4">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight mb-1">Security Ledger</h2>
                    <p className="text-sm text-ghost/60">Comprehensive audit list of all scanned libraries.</p>
                  </div>
                  <div className="flex gap-1 p-1 bg-surface border border-white/5 rounded-lg overflow-x-auto">
                    {["All", "CRITICAL", "HIGH", "MEDIUM", "LOW", "SAFE"].map(f => (
                      <button key={f} onClick={() => setFilt(f)}
                        className={`px-3 py-1.5 rounded-md text-sm font-bold tracking-wide transition-all whitespace-nowrap ${filt === f ? 'bg-background text-ghost shadow-sm border border-white/10' : 'text-ghost/40 hover:text-ghost border border-transparent'}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="glass-panel rounded-2xl overflow-hidden shadow-lg">
                  <div>
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-white/[0.02]">
                          {[["name", "Library"], ["version", "Version"], ["latest", "Latest"], ["sev", "Severity"], ["score", "Score"], ["vulns", "CVEs"], ["maint", "Maintainer"]].map(([c, l]) => (
                            <th key={c} onClick={() => doSort(c)} className="p-4 text-sm uppercase font-bold tracking-widest text-ghost/50 border-b border-white/5 cursor-pointer hover:bg-white/5">
                              <span className="flex items-center gap-2">{l} <span className={`${sCol === c ? 'opacity-100 text-primary' : 'opacity-0'}`}>{sDir === "asc" ? "↑" : "↓"}</span></span>
                            </th>
                          ))}
                          <th className="p-4 text-sm uppercase font-bold tracking-widest text-ghost/50 border-b border-white/5">Log</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {rows.map(d => (
                          <tr key={d.id} onClick={() => setSel(d)} className="hover:bg-white/5 cursor-pointer transition-colors group">
                            <td className="p-4 font-semibold">{d.name}</td>
                            <td className="p-4"><code className="text-sm text-ghost/60">{d.version}</code></td>
                            <td className="p-4"><code className={`text-sm ${d.version !== d.latest ? 'text-primary font-semibold' : 'text-ghost/60'}`}>{d.latest}</code></td>
                            <td className="p-4"><Chip sev={d.sev} /></td>
                            <td className="p-4 w-40 max-w-[160px]"><Bar score={d.score} /></td>
                            <td className="p-4"><span className={`font-mono font-medium text-sm ${d.vulns > 0 ? 'text-red-400' : 'text-ghost/30'}`}>{d.vulns}</span></td>
                            <td className="p-4">
                              <span className="flex items-center gap-2 text-sm font-bold tracking-wider">
                                <span className={`w-2 h-2 rounded-full ${d.maint === "Active" ? "bg-emerald-500" : d.maint === "Abandoned" ? "bg-amber-500" : "bg-ghost/40"}`} />
                                <span className={d.maint === "Active" ? "text-emerald-500" : d.maint === "Abandoned" ? "text-amber-500" : "text-ghost/40"}>{d.maint}</span>
                              </span>
                            </td>
                            <td className="p-4">
                              <button className="opacity-0 group-hover:opacity-100 text-sm font-semibold text-primary flex items-center gap-1 transition-opacity">
                                View <ArrowRight size={10} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* FIXES */}
            {tab === "fixes" && (
              <div className="max-w-4xl mx-auto">
                <div className="mb-10 text-center">
                  <h2 className="text-3xl font-bold tracking-tight mb-2">Remediation Blueprint</h2>
                  <p className="text-sm text-ghost/60">Ranked actionable fixes targeting the highest CVSS impact vectors.</p>
                </div>

                <div className="space-y-4">
                  {fixes.map((d, i) => (
                    <div key={d.id} className="glass-panel rounded-xl overflow-hidden shadow-sm relative">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-surface" style={{ backgroundColor: SEV[d.sev]?.hex }} />
                      <div className="p-6 pl-8">
                        <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-4">
                          <div>
                            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                              {d.name}
                              <span className="bg-background px-2 py-0.5 rounded text-sm font-mono font-normal border border-white/5 text-ghost/50 tracking-wider">v{d.version} &rarr; <span className="text-emerald-400">v{d.fixv}</span></span>
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <Chip sev={d.sev} />
                            <span className="px-2 py-1 bg-background border border-white/5 text-ghost/60 rounded text-sm uppercase font-bold tracking-wider">{d.effort} Fix</span>
                          </div>
                        </div>

                        <p className="text-sm text-ghost/70 leading-relaxed mb-4 border-l-2 border-white/10 pl-3">{d.desc}</p>

                        <div className="bg-background border border-white/5 rounded-lg p-3 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                          <code className="text-primary font-mono text-sm break-all tracking-wider">{d.fix}</code>
                          <Copy text={d.fix} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {fixes.length === 0 && (
                    <div className="text-center p-12 glass-panel rounded-2xl text-ghost/50 border-dashed">
                      <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-500 opacity-60" />
                      <p className="text-sm font-semibold">No actionable patches found.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── NEW: MONITORING DASHBOARD (authenticated users) ─── */}
        {phase === "monitoring" && (
          <MonitoringDashboard
            onViewScanResults={(results, repoName) => {
              // Load webhook scan results into the existing dashboard views
              // This reuses the exact same Dashboard/Graph/Vulns/Fixes rendering
              setScanResult(results);
              setUrl(repoName);
              setPhase("main");
              setTab("dashboard");
            }}
          />
        )}
      </main>

      <Panel dep={sel} onClose={() => setSel(null)} />
    </>
  );
}
