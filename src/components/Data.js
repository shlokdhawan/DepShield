export const DEPS = [];

export const PIPE = [
  { icon: "download", label: "Repo Cloner", desc: "Downloading codebase from remote" },
  { icon: "file-search", label: "Manifest Scanner", desc: "Reading package.json / requirements.txt" },
  { icon: "network", label: "Dependency Tree Builder", desc: "Mapping direct + transitive dependencies" },
  { icon: "shield", label: "Vulnerability Checker", desc: "Cross-referencing NVD + OSV databases" },
  { icon: "nodes", label: "Graph Engine", desc: "Constructing visual dependency map" },
  { icon: "gauge", label: "Risk Scoring Engine", desc: "Scoring by severity, depth, age, and maintainer health" },
  { icon: "git-branch", label: "Origin Tracer", desc: "Tracing how vulnerable libraries entered the project" },
  { icon: "list-checks", label: "Priority Ranker", desc: "Ranking remediation by impact" },
];

export const SEV = {
  CRITICAL: { color: "text-red-700", border: "border-red-300", bg: "bg-red-50", hex: "#DC2626" },
  HIGH: { color: "text-orange-700", border: "border-orange-300", bg: "bg-orange-50", hex: "#EA580C" },
  MEDIUM: { color: "text-yellow-700", border: "border-yellow-300", bg: "bg-yellow-50", hex: "#CA8A04" },
  LOW: { color: "text-amber-700", border: "border-amber-300", bg: "bg-amber-50", hex: "#D97706" },
  SAFE: { color: "text-green-700", border: "border-green-300", bg: "bg-green-50", hex: "#16A34A" },
};
