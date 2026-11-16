'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export const OPS_INPUT = 'w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2.5 text-white focus:border-amber-400 focus:outline-none';
export const OPS_LABEL = 'mb-1.5 block font-semibold text-neutral-300';

export function OpsModal({ eyebrow, title, onClose, children }: { eyebrow: string; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#121215] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">{eyebrow}</span>
              <h3 className="mt-0.5 font-display text-xl font-bold text-white">{title}</h3>
            </div>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-neutral-400 hover:text-white" onClick={onClose} type="button">✕</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function OpsTabs({ items }: { items: Array<{ key: string; icon: string; label: string; short: string; active: boolean; onClick?: () => void; href?: string }> }) {
  const cols = items.length === 2 ? 'grid-cols-2' : 'grid-cols-3';
  return (
    <div className={`grid ${cols} w-full shrink-0 gap-1 rounded-xl border border-white/10 bg-neutral-900 p-1 sm:flex sm:w-auto sm:items-center`}>
      {items.map((item) => {
        const cls = `flex items-center justify-center gap-1 rounded-lg px-1 py-2 text-xs font-semibold transition sm:gap-1.5 sm:px-3 ${item.active ? 'bg-amber-500 font-bold text-neutral-950 shadow-md shadow-amber-500/20' : 'text-neutral-400 hover:text-white'}`;
        const body = <><span className="text-sm">{item.icon}</span><span className="hidden md:inline">{item.label}</span><span className="text-[11px] md:hidden">{item.short}</span></>;
        return item.href ? <Link className={cls} href={item.href} key={item.key}>{body}</Link> : <button className={cls} key={item.key} onClick={item.onClick} type="button">{body}</button>;
      })}
    </div>
  );
}
