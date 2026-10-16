import { useState } from 'react';
import { Github, ArrowRight } from 'lucide-react';
import { API_BASE } from '../config/api';

export default function GitHubLoginButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/github`);
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not connect to GitHub.');

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to initiate GitHub login:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 text-center">
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-sky-200" />
        <span className="text-ghost/50 text-xs font-mono uppercase">
          Or monitor continuously
        </span>
        <div className="flex-1 h-px bg-sky-200" />
      </div>

      <button
        onClick={handleLogin}
        disabled={loading}
        className="group inline-flex items-center justify-center gap-3 px-6 py-3 rounded-lg font-body text-sm font-semibold transition-colors duration-200 bg-white border border-sky-200 hover:border-primary/40 hover:bg-sky-50 text-ghost disabled:opacity-60 disabled:cursor-not-allowed w-full"
      >
        {loading ? (
          <span className="spinner-vapor" />
        ) : (
          <Github size={20} className="text-ghost/80 group-hover:text-primary transition-colors" />
        )}

        <span>{loading ? 'Connecting to GitHub...' : 'Sign in with GitHub'}</span>

        {!loading && (
          <ArrowRight size={16} className="text-ghost/45 group-hover:text-primary transition-colors" />
        )}
      </button>

      <p className="mt-3 text-ghost/50 text-xs font-mono">
        Connect repos for automatic dependency monitoring
      </p>
      {error && <p role="alert" className="mt-3 text-red-700 text-sm">{error}</p>}
    </div>
  );
}
