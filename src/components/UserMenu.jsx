import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Monitor, LogOut, ChevronDown } from 'lucide-react';

export default function UserMenu({ onNavigateMonitoring }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

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
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sky-100 transition-colors duration-200 group"
      >
        <img
          src={user.avatar_url}
          alt={user.login}
          className="w-8 h-8 rounded-lg border border-sky-200 group-hover:border-primary/50 transition-colors"
        />
        <span className="hidden lg:block text-sm font-semibold text-ghost/80 group-hover:text-primary transition-colors max-w-[100px] truncate">
          {user.login}
        </span>
        <ChevronDown
          size={14}
          className={`text-ghost/50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-3 w-64 glass-panel rounded-lg overflow-hidden border border-sky-200 z-[100] animate-[fadeIn_0.15s_ease-out]">
          <div className="px-5 py-4 border-b border-sky-200 bg-sky-50">
            <div className="flex items-center gap-3">
              <img
                src={user.avatar_url}
                alt={user.login}
                className="w-10 h-10 rounded-lg border border-sky-200"
              />
              <div className="overflow-hidden">
                <div className="font-bold text-sm text-ghost truncate">
                  {user.name || user.login}
                </div>
                <div className="text-xs text-ghost/50 font-mono truncate">
                  @{user.login}
                </div>
              </div>
            </div>
          </div>

          <div className="py-2">
            <button
              onClick={() => {
                setOpen(false);
                onNavigateMonitoring?.();
              }}
              className="w-full flex items-center gap-3 px-5 py-3 text-sm text-ghost/75 hover:text-primary hover:bg-sky-50 transition-colors"
            >
              <Monitor size={16} className="text-primary" />
              <span className="font-medium">Monitoring Dashboard</span>
            </button>

            <div className="mx-4 h-px bg-sky-100 my-1" />

            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-3 px-5 py-3 text-sm text-ghost/60 hover:text-red-700 hover:bg-red-50 transition-colors"
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
