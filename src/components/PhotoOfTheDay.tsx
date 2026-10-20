/**
 * src/components/PhotoOfTheDay.tsx
 *
 * Full-bleed "Photo of the day" hero from the Figma "Concept A — Personal Gallery" design.
 * The first pick is the editorial Figma photograph; "Next pick" cycles through it and the
 * featured captures of the archive.
 *
 * The hero image is the page's LCP candidate: fetchPriority="high" without loading="lazy".
 */

import React, { useMemo, useState } from 'react';
import { Aperture, ArrowUpRight, Maximize2, Shuffle } from 'lucide-react';
import type { Capture } from '../types/gallery';
import { SITE_CONFIG } from '../data/siteConfig';

export interface PhotoOfTheDayProps {
  captures: Capture[];
  onSelectCapture: (capture: Capture) => void;
}

interface DailyPick {
  id: string;
  title: string;
  location: string | null;
  category: string;
  image: string;
  capture: Capture | null;
}

const EDITORIAL_PICK: DailyPick = {
  id: 'editorial-pick',
  title: 'Where the silence settles',
  location: 'Sossusvlei, Namibia',
  category: 'Landscape',
  image: '/images/photo-of-the-day.png',
  capture: null,
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const PhotoOfTheDay: React.FC<PhotoOfTheDayProps> = ({
  captures,
  onSelectCapture,
}) => {
  const [pickIndex, setPickIndex] = useState(0);

  const picks = useMemo<DailyPick[]>(
    () => [
      EDITORIAL_PICK,
      ...captures
        .filter((capture) => capture.featured)
        .map<DailyPick>((capture) => ({
          id: capture.id,
          title: capture.title,
          location: capture.location,
          category: capitalize(capture.collection_slug),
          image: capture.image_url,
          capture,
        })),
    ],
    [captures]
  );

  const pick = picks[pickIndex % picks.length];
  const edition = `No. ${String(42 + (pickIndex % picks.length)).padStart(3, '0')}`;
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const openPick = () => {
    if (pick.capture) {
      onSelectCapture(pick.capture);
    } else if (typeof window !== 'undefined') {
      window.open(pick.image, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <section
      aria-label="Photo of the day"
      className="relative isolate overflow-hidden text-white"
    >
      {/* Background photograph + contrast scrim */}
      <img
        src={pick.image}
        alt=""
        fetchPriority="high"
        className="absolute inset-0 -z-20 h-full w-full object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.5) 20%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.65) 100%)',
        }}
      />

      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pt-10 pb-10 sm:px-8 lg:px-16 lg:pb-16">
        {/* Daily introduction */}
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="flex flex-col gap-[14px]">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold tracking-wider uppercase">
                Photo of the day
              </span>
              <span className="text-[11px] text-white/80">/ {edition}</span>
            </div>
            <h1
              id="gallery-view-heading"
              tabIndex={-1}
              className="text-[40px] leading-[1.06] font-normal focus:outline-none sm:text-5xl lg:text-[58px]"
            >
              A moment, at home.
            </h1>
          </div>
          <div className="flex flex-col gap-[15px] pb-1 md:w-[255px]">
            <p className="text-[13px] leading-[1.6] text-white/80">
              A personal selection, every day.
              <br />
              One photograph from my own archive.
            </p>
            <p className="text-[11px] uppercase">{today}</p>
          </div>
        </div>

        {/* Featured photograph frame with badge and expand control */}
        <div className="relative h-[360px] sm:h-[460px] lg:h-[556px]">
          <span className="absolute top-5 left-5 inline-flex items-center gap-[7px] rounded-full bg-white/90 px-3 py-[7px] text-[10px] font-medium tracking-wider text-ink uppercase">
            <Aperture className="h-[13px] w-[13px]" aria-hidden="true" />
            Personal pick
          </span>
          <button
            type="button"
            onClick={openPick}
            aria-label={`Expand photograph: ${pick.title}`}
            className="absolute right-5 bottom-5 inline-flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/90 text-ink transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Maximize2 className="h-[17px] w-[17px]" aria-hidden="true" />
          </button>
        </div>

        {/* Featured caption + discovery actions */}
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div aria-live="polite" className="flex flex-col gap-2">
            <h2 className="text-[25px] leading-tight font-normal">
              {pick.title}
            </h2>
            <p className="flex flex-wrap items-center gap-x-3 text-[13px]">
              <span>By {SITE_CONFIG.photographer}</span>
              {pick.location && (
                <>
                  <span aria-hidden="true" className="text-white/80">
                    ·
                  </span>
                  <span className="text-white/80">{pick.location}</span>
                </>
              )}
              <span aria-hidden="true" className="text-white/80">
                ·
              </span>
              <span className="text-white/80">{pick.category}</span>
            </p>
          </div>

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={openPick}
              className="inline-flex min-h-10 items-center gap-2 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <span>View story</span>
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </button>
            {picks.length > 1 && (
              <button
                type="button"
                onClick={() => setPickIndex((index) => (index + 1) % picks.length)}
                className="inline-flex min-h-10 items-center gap-[10px] rounded-full border border-white/40 px-5 py-[13px] text-[13px] font-medium transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <Shuffle className="h-[18px] w-[18px]" aria-hidden="true" />
                <span>Next pick</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
