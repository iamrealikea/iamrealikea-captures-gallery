/**
 * src/components/AboutGearView.tsx
 *
 * Photographer statement, curatorial principles, and interactive
 * Gear & Optics Inventory linking directly to filtered captures.
 */

import React from 'react';
import { ArrowRight, Camera, Focus, MapPin, ShieldCheck } from 'lucide-react';
import { PHOTOGRAPHER_BIO } from '../data/seedCaptures';
import type { GearItem } from '../types/gallery';

export interface AboutGearViewProps {
  gearInventory: GearItem[];
  onFilterByGear: (gearName: string) => void;
}

export const AboutGearView: React.FC<AboutGearViewProps> = ({
  gearInventory,
  onFilterByGear,
}) => {
  const cameras = gearInventory.filter((g) => g.type === 'camera');
  const lenses = gearInventory.filter((g) => g.type === 'lens');

  return (
    <div className="space-y-12">
      {/* Photographer Statement Card (Prominent card: rounded-xl per DESIGN_SYSTEM.md) */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              <MapPin className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
              <span>
                {PHOTOGRAPHER_BIO.name} • {PHOTOGRAPHER_BIO.role} • {PHOTOGRAPHER_BIO.location}
              </span>
            </div>

            <h1
              id="about-view-heading"
              tabIndex={-1}
              className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl focus:outline-none"
            >
              {PHOTOGRAPHER_BIO.statementTitle}
            </h1>

            {PHOTOGRAPHER_BIO.statementParagraphs.map((paragraph, idx) => (
              <p
                key={idx}
                className="max-w-[65ch] text-base leading-7 text-slate-700 text-pretty"
              >
                {paragraph}
              </p>
            ))}
          </div>

          {/* Curatorial Principles */}
          <div className="w-full space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5 lg:w-80 lg:shrink-0">
            <h2 className="text-sm font-semibold text-slate-900">
              Archival principles
            </h2>
            <div className="divide-y divide-slate-200">
              {PHOTOGRAPHER_BIO.principles.map((p) => (
                <div key={p.title} className="py-3 first:pt-1 last:pb-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    <ShieldCheck
                      className="h-3.5 w-3.5 text-blue-600"
                      aria-hidden="true"
                    />
                    <span>{p.title}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600 text-pretty">
                    {p.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Gear & Optics Inventory */}
      <section aria-labelledby="gear-inventory-heading" className="space-y-8">
        <div>
          <h2
            id="gear-inventory-heading"
            className="text-2xl font-bold text-slate-900"
          >
            Gear &amp; optics inventory
          </h2>
          <p className="mt-1 max-w-[65ch] text-sm leading-6 text-slate-600 text-pretty">
            Select any camera body or lens below to filter the gallery to
            photographs captured with that optical instrument.
          </p>
        </div>

        {/* Camera Bodies */}
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Camera className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <span>Camera bodies</span>
          </h3>

          {cameras.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              No camera bodies currently registered in the inventory.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {cameras.map((item) => (
                <div
                  key={item.id}
                  data-testid={`gear-card-${item.id}`}
                  className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {item.brand}
                        </span>
                        <h4 className="mt-0.5 text-lg font-semibold text-slate-900">
                          {item.name}
                        </h4>
                      </div>
                      <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        {item.capture_count} captures
                      </span>
                    </div>

                    <p className="mt-2 font-mono text-xs text-slate-600">
                      {item.sensor_or_mount}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{item.specs}</p>

                    {item.description && (
                      <p className="mt-3 max-w-[65ch] text-sm leading-6 text-slate-600 text-pretty">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => onFilterByGear(item.name)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      <span>View {item.name} captures</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lenses / Optics */}
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Focus className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <span>Reference optics &amp; primes</span>
          </h3>

          {lenses.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              No lenses currently registered in the inventory.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {lenses.map((item) => (
                <div
                  key={item.id}
                  data-testid={`gear-card-${item.id}`}
                  className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {item.brand}
                        </span>
                        <h4 className="mt-0.5 text-lg font-semibold text-slate-900">
                          {item.name}
                        </h4>
                      </div>
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {item.capture_count} captures
                      </span>
                    </div>

                    <p className="mt-2 font-mono text-xs text-slate-600">
                      {item.sensor_or_mount}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{item.specs}</p>

                    {item.description && (
                      <p className="mt-3 max-w-[65ch] text-sm leading-6 text-slate-600 text-pretty">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => onFilterByGear(item.name)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      <span>View {item.name} captures</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AboutGearView;
