import type { Movie } from '@/lib/catalog/catalog-client';

const POSTER_GRADIENTS = [
  { gradient: 'from-amber-700 via-orange-950 to-neutral-950', accent: '#F59E0B' },
  { gradient: 'from-sky-700 via-indigo-950 to-neutral-950', accent: '#38BDF8' },
  { gradient: 'from-rose-700 via-rose-950 to-neutral-950', accent: '#FB7185' },
  { gradient: 'from-emerald-700 via-emerald-950 to-neutral-950', accent: '#34D399' },
  { gradient: 'from-violet-700 via-purple-950 to-neutral-950', accent: '#A78BFA' },
];

export function posterTheme(movie: Pick<Movie, 'id'>) {
  const hash = [...movie.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return POSTER_GRADIENTS[hash % POSTER_GRADIENTS.length];
}

export function CompactPoster({ movie }: { movie?: Movie }) {
  if (!movie) return null;
  const initial = movie.title ? movie.title.slice(0, 2).toUpperCase() : 'ML';
  return (
    <div className="relative h-20 w-14 min-w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-lg shadow-black/50">
      <div className="absolute inset-0 flex items-center justify-center bg-neutral-950 font-display text-base font-extrabold tracking-tighter text-white/90">{initial}</div>
      {movie.posterUrl ? <img alt={movie.title} className="absolute inset-0 z-10 block h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} src={movie.posterUrl} /> : null}
    </div>
  );
}

export function FullPoster({ movie }: { movie: Movie }) {
  const theme = posterTheme(movie);
  return (
    <div className="group relative flex aspect-[2/3] w-full select-none flex-col justify-between overflow-hidden rounded-2xl bg-neutral-900 p-3.5 shadow-xl ring-1 ring-white/10">
      {movie.posterUrl ? (
        <>
          <img alt={movie.title} className="absolute inset-0 z-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" onError={(event) => { event.currentTarget.style.display = 'none'; }} src={movie.posterUrl} />
          <div className="absolute inset-0 z-[1] bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-black/20" />
        </>
      ) : (
        <div className={`absolute inset-0 z-0 bg-gradient-to-br ${theme.gradient}`} />
      )}
      <div className="absolute -right-12 -top-12 z-[2] h-32 w-32 rounded-full opacity-25 blur-2xl" style={{ background: theme.accent }} />
      <div className="z-10 flex items-center justify-between">
        <span className="rounded-md border border-white/15 bg-black/75 px-2 py-0.5 text-[10px] font-bold text-neutral-200 backdrop-blur-md">{movie.ageRating}</span>
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${movie.status === 'NOW_SHOWING' ? 'border border-white/10 bg-black/75 text-amber-400 backdrop-blur-md' : 'border border-amber-400/30 bg-amber-500/20 text-amber-300'}`}>
          {movie.status === 'NOW_SHOWING' ? 'ĐANG CHIẾU' : movie.status === 'COMING_SOON' ? 'SẮP CHIẾU' : 'ĐÃ KẾT THÚC'}
        </span>
      </div>
      <div className="z-10 mt-auto">
        <p className="mb-1 line-clamp-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">{movie.genre}</p>
        <h4 className="line-clamp-2 font-display text-sm font-bold leading-snug text-white drop-shadow sm:text-base">{movie.title}</h4>
      </div>
    </div>
  );
}
