/**
 * GitHubLoginButton — "Sign in with GitHub" CTA for the home screen.
 *
 * OAuth Flow (from the user's perspective):
 *   1. User clicks this button
 *   2. We call GET /api/auth/github to get the GitHub authorization URL
 *   3. Browser redirects to github.com where user approves access
 *   4. GitHub redirects back to /api/auth/github/callback?code=XXX
 *   5. Backend exchanges code → token → creates JWT → redirects to frontend
 *   6. Frontend's App.jsx detects ?auth_token= in the URL → stores it
 *
 * This button is styled to match the existing "btn-vapor" design system.
 * It sits on the input screen below the existing scan form, providing
 * a second path: "Or sign in for continuous monitoring."
 */

import { useState } from 'react';
import { Github } from 'lucide-react';
import { API_BASE } from '../config/api';

export default function GitHubLoginButton() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      // Ask the backend for the GitHub OAuth authorization URL
      const res = await fetch(`${API_BASE}/api/auth/github`);
      const data = await res.json();

      if (data.url) {
        // Redirect the browser to GitHub's OAuth consent page
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to initiate GitHub login:', err);
      setLoading(false);
    }
  };

  return (
    <div className="mt-10 text-center gsap-stagger">
      {/* Divider */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <span className="text-ghost/30 text-xs font-mono uppercase tracking-widest">
          Or monitor continuously
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* GitHub Login Button */}
      <button
        onClick={handleLogin}
        disabled={loading}
        className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-body text-sm font-semibold tracking-wide overflow-hidden transition-all duration-400 bg-white/[0.03] border border-white/10 hover:border-white/20 hover:bg-white/[0.06] text-ghost hover:shadow-[0_0_30px_rgba(255,255,255,0.05)] disabled:opacity-50 disabled:cursor-not-allowed w-full"
      >
        {/* Animated gradient border on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        {loading ? (
          <span className="spinner-vapor" />
        ) : (
          <Github size={20} className="text-ghost/80 group-hover:text-white transition-colors" />
        )}

        <span className="relative z-10">
          {loading ? 'Connecting to GitHub...' : 'Sign in with GitHub'}
        </span>

        {/* Subtle arrow */}
        {!loading && (
          <svg className="w-4 h-4 text-ghost/40 group-hover:text-ghost/70 group-hover:translate-x-1 transition-all" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
          </svg>
        )}
      </button>

      {/* Subtext */}
      <p className="mt-4 text-ghost/30 text-xs font-mono">
        Connect your GitHub repos for automatic dependency monitoring
      </p>
    </div>
  );
}
