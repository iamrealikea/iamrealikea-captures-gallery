/**
 * src/components/Navbar.tsx
 *
 * Top-level 4-item navigation bar adhering strictly to DESIGN_SYSTEM.md:
 * - Concise 4-item navigation: Gallery, Collections, About & gear, Admin studio
 * - Sentence case labels with text-sm font-medium
 * - Active page communicated via both color (#2563EB / bg-blue-50) and structural border indicator
 * - Minimum 40px (min-h-10) hit targets and visible focus ring
 */

import React from 'react';
import { Camera, Grid, Layers, ShieldCheck, Sliders } from 'lucide-react';
import type { ActiveView, AuthSession } from '../types/gallery';

export interface NavbarProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  totalCapturesCount: number;
  authSession: AuthSession;
}

interface NavItemConfig {
  id: ActiveView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'gallery', label: 'Gallery', icon: Grid },
  { id: 'collections', label: 'Collections', icon: Layers },
  { id: 'about', label: 'About & gear', icon: Camera },
  { id: 'admin', label: 'Admin studio', icon: Sliders },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  onSelectView,
  totalCapturesCount,
  authSession,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        {/* Brand Identity */}
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onSelectView('gallery')}
            className="group inline-flex min-h-10 items-center gap-2.5 rounded-lg px-2 py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white transition-colors group-hover:bg-blue-600">
              <Camera className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <span className="block text-base font-bold tracking-tight text-slate-900">
                Captures
              </span>
              <span className="block text-xs font-medium text-slate-500">
                {totalCapturesCount} archival frames
              </span>
            </div>
          </button>

          {/* Compact Zero Trust indicator on mobile */}
          {authSession.authenticated && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 sm:hidden">
              <ShieldCheck
                className="h-3.5 w-3.5 text-green-600"
                aria-hidden="true"
              />
              <span>Zero Trust active</span>
            </div>
          )}
        </div>

        {/* Primary 4-item Navigation */}
        <nav
          aria-label="Primary navigation"
          className="flex flex-wrap items-center gap-1.5 sm:gap-2"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectView(item.id)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  isActive
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-transparent bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    isActive ? 'text-blue-600' : 'text-slate-500'
                  }`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
