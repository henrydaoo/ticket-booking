import type { SVGProps } from 'react';

export function MoonlightMark(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-5.4-5.4c0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" /><path d="M19 3l.8 1.8L21.6 5.6 19.8 6.4 19 8.2l-.8-1.8L16.4 5.6l1.8-.8L19 3z" /></svg>;
}

export function MoonlightBrand({ compact = false }: { compact?: boolean }) {
  return <span className="flex items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-zinc-950 shadow-lg shadow-amber-500/20"><MoonlightMark className="h-5 w-5" /></span>{!compact ? <span className="hidden lg:block"><span className="block font-display text-base font-extrabold leading-none tracking-tight text-white">MOONLIGHT</span><span className="mt-1 block font-mono text-[9px] font-semibold tracking-[0.3em] text-amber-400">CINEMA</span></span> : null}</span>;
}
