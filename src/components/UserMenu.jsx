/**
 * UserMenu — Authenticated user avatar + dropdown in the navigation header.
 *
 * Shown when the user is logged in via GitHub OAuth.
 * Provides:
 *   - User avatar + name display
 *   - "Monitoring Dashboard" link (navigates to monitoring phase)
 *   - "Sign Out" action
 *
 * Styled to match the existing glassmorphism nav design.
 */

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Monitor, LogOut, ChevronDown } from 'lucide-react';

export default function UserMenu({ onNavigateMonitoring }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-full hover:bg-white/5 transition-all duration-200 group"
      >
        <img
          src={user.avatar_url}
          alt={user.login}
          className="w-8 h-8 rounded-full border-2 border-white/10 group-hover:border-primary/50 transition-colors shadow-[0_0_10px_rgba(0,0,0,0.3)]"
        />
        <span className="hidden lg:block text-sm font-semibold text-ghost/80 group-hover:text-ghost transition-colors max-w-[100px] truncate">
          {user.login}
        </span>
        <ChevronDown
          size={14}
          className={`text-ghost/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute right-0 top-full mt-3 w-64 glass-panel rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-white/10 z-[100] animate-[fadeIn_0.15s_ease-out]">
          {/* User info header */}
          <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <img
                src={user.avatar_url}
                alt={user.login}
                className="w-10 h-10 rounded-full border border-white/10"
              />
              <div className="overflow-hidden">
                <div className="font-bold text-sm text-ghost truncate">
                  {user.name || user.login}
                </div>
                <div className="text-xs text-ghost/40 font-mono truncate">
                  @{user.login}
                </div>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-2">
            <button
              onClick={() => {
                setOpen(false);
                onNavigateMonitoring?.();
              }}
              className="w-full flex items-center gap-3 px-5 py-3 text-sm text-ghost/70 hover:text-ghost hover:bg-white/5 transition-all"
            >
              <Monitor size={16} className="text-primary" />
              <span className="font-medium">Monitoring Dashboard</span>
            </button>

            <div className="mx-4 h-px bg-white/5 my-1" />

            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-3 px-5 py-3 text-sm text-ghost/50 hover:text-red-400 hover:bg-red-500/5 transition-all"
            >
              <LogOut size={16} />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
