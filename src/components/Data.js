export const DEPS = [];

export const PIPE = [
  { icon: "⬡", label: "Repo Cloner", desc: "Downloading codebase from remote" },
  { icon: "⬡", label: "Manifest Scanner", desc: "Reading package.json / requirements.txt" },
  { icon: "⬡", label: "Dependency Tree Builder", desc: "Mapping direct + transitive dependencies" },
  { icon: "⬡", label: "Vulnerability Checker", desc: "Cross-referencing NVD + OSV databases" },
  { icon: "⬡", label: "Graph Engine", desc: "Constructing visual dependency map" },
  { icon: "⬡", label: "Risk Scoring Engine", desc: "Scoring by Severity, Depth, Age & Maintainer Health" },
  { icon: "⬡", label: "Origin Tracer", desc: "Tracing how vulnerable libs entered the project" },
  { icon: "⬡", label: "Priority Ranker", desc: "Ranking remediation by impact" },
];

export const SEV = {
  CRITICAL: { color: "text-red-500", border: "border-red-500/30", bg: "bg-red-500/10", hex: "#ef4444" },
  HIGH: { color: "text-orange-500", border: "border-orange-500/30", bg: "bg-orange-500/10", hex: "#f97316" },
  MEDIUM: { color: "text-yellow-500", border: "border-yellow-500/30", bg: "bg-yellow-500/10", hex: "#eab308" },
  LOW: { color: "text-amber-500", border: "border-amber-500/30", bg: "bg-amber-500/10", hex: "#f59e0b" },
  SAFE: { color: "text-teal-400", border: "border-teal-400/30", bg: "bg-teal-400/10", hex: "#2dd4bf" },
};
