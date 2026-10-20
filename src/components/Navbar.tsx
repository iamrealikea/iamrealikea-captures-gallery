/**
 * src/components/Navbar.tsx
 *
 * Top navigation from the Figma "Concept A — Personal Gallery" design:
 * - Identity lockup ("captures." + "A personal gallery")
 * - Main links: Gallery, Collections, About (active link: semibold + 1px ink underline)
 * - Actions: search shortcut and a pill "Contact" link
 * The Admin studio is reachable from the footer and the /admin URL.
 */

import React from 'react';
import { Search } from 'lucide-react';
import type { ActiveView, AuthSession } from '../types/gallery';
import { SITE_CONFIG } from '../data/siteConfig';

export interface NavbarProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  onSearch?: () => void;
  totalCapturesCount?: number;
  authSession?: AuthSession;
}

interface NavItemConfig {
  id: ActiveView;
  label: string;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'gallery', label: 'Gallery' },
  { id: 'collections', label: 'Collections' },
  { id: 'about', label: 'About' },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  onSelectView,
  onSearch,
}) => {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex min-h-[104px] w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 py-4 sm:px-8 lg:px-16">
        {/* Identity */}
        <button
          type="button"
          onClick={() => onSelectView('gallery')}
          className="flex min-h-10 items-center gap-4 text-left focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <span className="text-[40px] leading-none font-semibold tracking-tight text-ink sm:text-[48px]">
            captures.
          </span>
          <span
            className="hidden text-[10px] leading-[1.45] tracking-wider text-stone uppercase sm:block"
            aria-hidden="true"
          >
            A personal
            <br />
            gallery
          </span>
          <span className="sr-only">A personal gallery</span>
        </button>

        {/* Main links */}
        <nav
          aria-label="Primary navigation"
          className="order-3 flex w-full items-center gap-8 md:order-none md:w-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectView(item.id)}
                className={`min-h-10 border-b py-[9px] text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 ${
                  isActive
                    ? 'border-ink font-semibold text-ink'
                    : 'border-transparent text-stone hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center justify-end gap-6">
          <button
            type="button"
            aria-label="Go to search"
            onClick={onSearch}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-line/40 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
          <a
            href={`mailto:${SITE_CONFIG.contactEmail}`}
            className="inline-flex min-h-10 items-center rounded-full border border-line px-5 py-[13px] text-[13px] font-medium text-ink transition-colors hover:bg-line/40 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Contact
          </a>
        </div>
      </div>
    </header>
  );
};
