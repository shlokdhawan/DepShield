/**
 * MonitoringDashboard — Authenticated user's repo monitoring view.
 *
 * This is the "path B" of DepShield:
 *   Path A (existing): Public scan → paste URL → one-time results
 *   Path B (new):      GitHub login → connect repos → continuous monitoring
 *
 * Features:
 *   - Welcome section with user avatar
 *   - "Connect GitHub Repositories" button (GitHub App install flow)
 *   - List of connected repos with latest scan status/grade
 *   - Click a repo to load its scan results into the existing dashboard views
 *
 * GitHub App Install Flow:
 *   1. User clicks "Connect Repositories"
 *   2. Browser opens the GitHub App installation page
 *   3. User selects repos and installs the App
 *   4. GitHub sends an installation webhook to our backend
 *   5. Backend saves the installation + repos via adapter
 *   6. User returns to this dashboard and sees their repos listed
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  GitBranch, Plus, RefreshCw, Shield, ShieldAlert,
  CheckCircle2, AlertTriangle, Clock, ExternalLink, Zap
} from 'lucide-react';
import { API_BASE } from '../config/api';

// The GitHub App name — used to build the installation URL
// In production this comes from VITE_GITHUB_APP_NAME env var
const GITHUB_APP_NAME = import.meta.env.VITE_GITHUB_APP_NAME || 'depshield';

// Grade color mapping (matches App.jsx logic)
const GRADE_COLORS = {
  A: '#2dd4bf',  // teal
  B: '#7B61FF',  // primary
  C: '#f59e0b',  // amber
  D: '#f97316',  // orange
  F: '#ef4444',  // red
};

export default function MonitoringDashboard({ onViewScanResults }) {
  const { user, token } = useAuth();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Fetch the user's connected repositories from the backend.
   */
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
    } catch (err) {
      setError('Network error loading repositories');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    // Check URL for GitHub App installation redirect
    const params = new URLSearchParams(window.location.search);
    const installationId = params.get('installation_id');
    const setupAction = params.get('setup_action');

    if (installationId && setupAction === 'install') {
      console.log('installation_id detected in URL');
      console.log('calling store-installation');
      
      // Clean URL so a refresh doesn't trigger this again
      window.history.replaceState({}, document.title, window.location.pathname);

      fetch(`${API_BASE}/api/github/store-installation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ installation_id: installationId })
      })
      .then(res => {
        if (res.ok) {
          console.log('store-installation success');
          fetchRepos();
        } else {
          console.error('store-installation failed');
          fetchRepos();
        }
      })
      .catch(err => {
        console.error(err);
        fetchRepos();
      });
    } else {
      fetchRepos();
    }
  }, [token, fetchRepos]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRepos();
  };

  /**
   * Open the GitHub App installation page.
   * After installation, the webhook callback saves the repos,
   * and the user can refresh this page to see them.
   */
  const handleConnectRepos = () => {
    const installUrl = `https://github.com/apps/${GITHUB_APP_NAME}/installations/new`;
    window.open(installUrl, '_blank');
  };

  /**
   * Load a repo's full scan results for display in the existing dashboard views.
   */
  const handleViewRepo = async (repo) => {
    if (!repo.latest_scan) return;
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/scan-history/${repo.full_name}?full=true`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const scans = await res.json();
        if (scans.length > 0 && scans[0].results) {
          // Pass the results to the parent (App.jsx) to render using
          // the existing dashboard/graph/vulns/fixes views
          onViewScanResults?.(scans[0].results, repo.full_name);
        }
      }
    } catch (err) {
      console.error('Failed to fetch scan results:', err);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Welcome Header */}
      <div className="text-center mb-12 gsap-stagger">
        <div className="inline-flex items-center gap-4 mb-6">
          <img
            src={user.avatar_url}
            alt={user.login}
            className="w-16 h-16 rounded-2xl border-2 border-primary/30 shadow-[0_0_20px_rgba(123,97,255,0.2)]"
          />
          <div className="text-left">
            <h1 className="font-drama text-4xl italic leading-none tracking-tight">
              Monitoring Dashboard
            </h1>
            <p className="text-ghost/50 text-sm font-mono mt-2">
              @{user.login} · Continuous dependency monitoring
            </p>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8 gsap-stagger">
        <button
          onClick={handleConnectRepos}
          className="btn-vapor-primary flex items-center justify-center gap-3 py-4 px-8 flex-1 text-base"
        >
          <Plus size={20} />
          Connect GitHub Repositories
        </button>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-vapor flex items-center justify-center gap-2 py-4 px-6"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl p-4 mb-6 text-sm font-mono flex items-center gap-3 gsap-stagger">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="glass-panel rounded-3xl p-16 flex flex-col items-center justify-center gsap-stagger">
          <span className="spinner-vapor !w-8 !h-8 mb-6" />
          <p className="text-ghost/40 text-sm font-mono">Loading connected repositories...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && repos.length === 0 && (
        <div className="glass-panel rounded-3xl p-16 text-center gsap-stagger">
          <div className="w-20 h-20 mx-auto mb-8 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_30px_rgba(123,97,255,0.15)]">
            <GitBranch size={32} className="text-primary" />
          </div>
          <h3 className="text-xl font-bold font-head mb-3 tracking-tight">No repositories connected</h3>
          <p className="text-ghost/50 text-sm font-body max-w-md mx-auto mb-8 leading-relaxed">
            Install the DepShield GitHub App on your repositories to enable automatic
            dependency scanning on every push. We'll monitor your package.json for changes
            and alert you to new vulnerabilities.
          </p>
          <button
            onClick={handleConnectRepos}
            className="btn-vapor-primary py-3 px-8 text-sm"
          >
            <Zap size={16} />
            Install DepShield App
          </button>
        </div>
      )}

      {/* Repository List */}
      {!loading && repos.length > 0 && (
        <div className="space-y-4 gsap-stagger">
          {repos.map((repo) => {
            const scan = repo.latest_scan;
            const gradeColor = scan ? (GRADE_COLORS[scan.grade] || '#7B61FF') : '#4B5563';

            return (
              <div
                key={repo.full_name}
                onClick={() => handleViewRepo(repo)}
                className="glass-panel rounded-2xl p-6 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group relative overflow-hidden"
              >
                {/* Accent line */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 group-hover:w-1.5"
                  style={{
                    backgroundColor: gradeColor,
                    boxShadow: `0 0 12px ${gradeColor}40`,
                  }}
                />

                <div className="flex items-center justify-between pl-4">
                  {/* Repo info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-sm tracking-wide truncate group-hover:text-primary transition-colors">
                        {repo.full_name}
                      </h3>
                      {repo.private && (
                        <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-ghost/40 uppercase">
                          Private
                        </span>
                      )}
                    </div>

                    {scan ? (
                      <div className="flex items-center gap-4 text-xs font-mono text-ghost/50">
                        <span className="flex items-center gap-1.5">
                          <Clock size={12} />
                          {new Date(scan.scanned_at).toLocaleDateString()}
                        </span>
                        <span>{scan.total_deps} packages</span>
                        {scan.critical > 0 && (
                          <span className="text-red-500 font-bold flex items-center gap-1">
                            <ShieldAlert size={12} />
                            {scan.critical} critical
                          </span>
                        )}
                        {scan.high > 0 && (
                          <span className="text-orange-500 font-bold">
                            {scan.high} high
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-ghost/30 font-mono flex items-center gap-2">
                        <Clock size={12} />
                        No scans yet — waiting for a push event
                      </p>
                    )}
                  </div>

                  {/* Grade badge */}
                  <div className="flex items-center gap-4">
                    {scan ? (
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center font-drama text-3xl italic font-bold transition-all duration-300 group-hover:scale-110 border"
                        style={{
                          color: gradeColor,
                          borderColor: `${gradeColor}40`,
                          backgroundColor: `${gradeColor}10`,
                          textShadow: `0 0 20px ${gradeColor}60`,
                        }}
                      >
                        {scan.grade}
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10 bg-white/[0.02]">
                        <Shield size={20} className="text-ghost/20" />
                      </div>
                    )}

                    <ExternalLink
                      size={16}
                      className="text-ghost/20 group-hover:text-ghost/50 transition-colors"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer hint */}
      <div className="mt-12 text-center gsap-stagger">
        <p className="text-ghost/20 text-xs font-mono">
          Scans are triggered automatically when package.json or package-lock.json changes.
        </p>
      </div>
    </div>
  );
}
