import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  GitBranch, Plus, RefreshCw, Shield, ShieldAlert,
  AlertTriangle, Clock, ExternalLink, Zap
} from 'lucide-react';
import { API_BASE } from '../config/api';

const GITHUB_APP_NAME = import.meta.env.VITE_GITHUB_APP_NAME || 'depshield';

const GRADE_COLORS = {
  A: '#16A34A',
  B: '#0369A1',
  C: '#CA8A04',
  D: '#EA580C',
  F: '#DC2626',
};

export default function MonitoringDashboard({ onViewScanResults, onTriggerPipeline }) {
  const { user, token } = useAuth();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [scanningRepos, setScanningRepos] = useState(new Set());

  const fetchRepos = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/repos`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRepos(data);
        setError('');
      } else {
        setError('Failed to load repositories');
      }
    } catch {
      setError('Network error loading repositories');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const installationId = params.get('installation_id');
    const setupAction = params.get('setup_action');

    if (installationId && (setupAction === 'install' || setupAction === 'update')) {
      window.history.replaceState({}, document.title, window.location.pathname);

      fetch(`${API_BASE}/api/github/store-installation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ installation_id: installationId })
      })
      .then(() => fetchRepos())
      .catch(() => fetchRepos());
    } else {
      fetchRepos();
    }

    const interval = setInterval(() => {
      fetchRepos();
    }, 10000);

    return () => clearInterval(interval);
  }, [token, fetchRepos]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRepos();
  };

  const handleConnectRepos = () => {
    const installUrl = `https://github.com/apps/${GITHUB_APP_NAME}/installations/new`;
    window.open(installUrl, '_blank');
  };

  const handleViewRepo = async (repo) => {
    if (!repo.latest_scan) {
      handleTriggerScan(repo.full_name);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/scan-history/${repo.full_name}?full=true`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const scans = await res.json();
        if (scans.length > 0 && scans[0].results) {
          onViewScanResults?.(scans[0].results, repo.full_name);
        }
      }
    } catch (err) {
      console.error('Failed to fetch scan results:', err);
    }
  };

  const handleTriggerScan = async (repoFullName) => {
    if (scanningRepos.has(repoFullName)) return;

    if (onTriggerPipeline) {
      const p = fetch(`${API_BASE}/api/dashboard/scan/${repoFullName}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(async r => {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with ${r.status}`);
        }
        return r.json();
      });
      onTriggerPipeline(p, repoFullName);
      return;
    }

    setScanningRepos(prev => new Set(prev).add(repoFullName));
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/scan/${repoFullName}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        fetchRepos();
        if (data.results) {
          onViewScanResults?.(data.results, repoFullName);
        }
      } else {
        const errorData = await res.json();
        alert(`Scan failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setScanningRepos(prev => {
        const next = new Set(prev);
        next.delete(repoFullName);
        return next;
      });
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-4">
          <img
            src={user.avatar_url}
            alt={user.login}
            className="w-14 h-14 rounded-lg border border-sky-200"
          />
          <div>
            <h1 className="font-head text-3xl font-bold leading-tight text-ghost">
              Monitoring Dashboard
            </h1>
            <p className="text-ghost/60 text-sm font-mono mt-1">
              @{user.login} - continuous dependency monitoring
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleConnectRepos}
            className="btn-vapor-primary flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Connect Repositories
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-vapor flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm font-mono flex items-center gap-3">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {loading && (
        <div className="glass-panel p-12 flex flex-col items-center justify-center">
          <span className="spinner-vapor !w-8 !h-8 mb-5" />
          <p className="text-ghost/60 text-sm font-mono">Loading connected repositories...</p>
        </div>
      )}

      {!loading && repos.length === 0 && (
        <div className="glass-panel p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center">
            <GitBranch size={28} className="text-primary" />
          </div>
          <h3 className="text-xl font-bold font-head mb-3">No repositories connected</h3>
          <p className="text-ghost/60 text-sm max-w-md mx-auto mb-7 leading-relaxed">
            Install the DepShield GitHub App on repositories that should receive automatic dependency scans on package changes.
          </p>
          <button
            onClick={handleConnectRepos}
            className="btn-vapor-primary py-3 px-6 text-sm"
          >
            <Zap size={16} />
            Install DepShield App
          </button>
        </div>
      )}

      {!loading && repos.length > 0 && (
        <div className="space-y-3">
          {repos.map((repo) => {
            const scan = repo.latest_scan;
            const gradeColor = scan ? (GRADE_COLORS[scan.grade] || '#0369A1') : '#64748B';

            return (
              <div
                key={repo.full_name}
                onClick={() => handleViewRepo(repo)}
                className="glass-panel p-5 cursor-pointer group relative overflow-hidden hover:border-primary/30"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: gradeColor }} />

                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pl-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                        {repo.full_name}
                      </h3>
                      {repo.private && (
                        <span className="px-2 py-0.5 bg-sky-50 border border-sky-200 rounded text-[10px] font-mono text-ghost/60 uppercase">
                          Private
                        </span>
                      )}
                    </div>

                    {scan ? (
                      <div className="flex items-center gap-4 text-xs font-mono text-ghost/60 flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <Clock size={12} />
                          {new Date(scan.scanned_at).toLocaleDateString()}
                        </span>
                        <span>{scan.total_deps} packages</span>
                        {scan.critical > 0 && (
                          <span className="text-red-700 font-bold flex items-center gap-1">
                            <ShieldAlert size={12} />
                            {scan.critical} critical
                          </span>
                        )}
                        {scan.high > 0 && (
                          <span className="text-orange-700 font-bold">
                            {scan.high} high
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-ghost/50 font-mono flex items-center gap-2">
                        <Clock size={12} />
                        No scans yet - waiting for a push event
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 md:gap-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTriggerScan(repo.full_name);
                      }}
                      disabled={scanningRepos.has(repo.full_name)}
                      className={`p-2 rounded-lg border transition-colors ${
                        scanningRepos.has(repo.full_name)
                          ? 'bg-sky-50 border-primary/30 text-primary animate-pulse'
                          : 'bg-white border-sky-200 text-ghost/60 hover:bg-sky-50 hover:border-primary/30 hover:text-primary'
                      }`}
                      title="Trigger manual scan"
                    >
                      {scanningRepos.has(repo.full_name) ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Zap size={16} />
                      )}
                    </button>

                    {scan ? (
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center font-head text-2xl font-bold border"
                        style={{
                          color: gradeColor,
                          borderColor: `${gradeColor}55`,
                          backgroundColor: `${gradeColor}12`,
                        }}
                      >
                        {scan.grade}
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center border border-sky-200 bg-sky-50">
                        <Shield size={20} className="text-ghost/40" />
                      </div>
                    )}

                    <ExternalLink
                      size={16}
                      className="text-ghost/35 group-hover:text-primary transition-colors"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10 text-center">
        <p className="text-ghost/45 text-xs font-mono">
          Scans are triggered automatically when package.json or package-lock.json changes.
        </p>
      </div>
    </div>
  );
}
