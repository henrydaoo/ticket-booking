'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { useMutation } from '@tanstack/react-query';
import { readSession, subscribeToSession } from '@/lib/auth/auth-boundary';
import { logout } from '@/lib/auth/auth-client';
import { SessionLifecycle } from '@/components/auth/session-lifecycle';

type RoleKey = 'CUSTOMER' | 'CINEMA_STAFF' | 'CINEMA_MANAGER' | 'PLATFORM_ADMIN' | 'GUEST';

const ROLE_TITLES: Record<Exclude<RoleKey, 'GUEST'>, string> = {
  CUSTOMER: 'Khách hàng',
  CINEMA_STAFF: 'Soát vé QR',
  CINEMA_MANAGER: 'Quản lý rạp',
  PLATFORM_ADMIN: 'Quản trị viên',
};

const ROLE_HOME: Record<Exclude<RoleKey, 'GUEST'>, string> = {
  CUSTOMER: '/account/bookings',
  CINEMA_STAFF: '/staff',
  CINEMA_MANAGER: '/staff',
  PLATFORM_ADMIN: '/admin',
};

function resolveRole(roles: string[]): RoleKey {
  if (roles.includes('PLATFORM_ADMIN')) return 'PLATFORM_ADMIN';
  if (roles.includes('CINEMA_MANAGER')) return 'CINEMA_MANAGER';
  if (roles.includes('CINEMA_STAFF')) return 'CINEMA_STAFF';
  if (roles.includes('CUSTOMER')) return 'CUSTOMER';
  return 'GUEST';
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const session = useSyncExternalStore(subscribeToSession, readSession, () => null);
  const role = session ? resolveRole(session.user.roles) : 'GUEST';
  const isAuth = role !== 'GUEST';
  const displayName = session?.user.email?.split('@')[0] ?? '';
  const initials = displayName.slice(0, 2).toUpperCase() || 'ML';
  const logoutMutation = useMutation({
    mutationFn: (target: string) => logout().then(() => target),
    onSettled: (data, _error, target) => window.location.assign(data ?? target),
  });

  const navLinks = [
    { label: 'Phim', short: 'Phim', href: '/movies', icon: '🎬' },
    { label: 'Cụm Rạp', short: 'Rạp', href: '/cinemas', icon: '🏛️' },
    ...(role === 'CUSTOMER' ? [{ label: 'Vé Của Tôi', short: 'Vé', href: '/account/bookings', icon: '🎫' }] : []),
  ];
  const opsLabel = role === 'CINEMA_STAFF' ? 'Cổng Soát Vé' : role === 'CINEMA_MANAGER' ? 'Quản Lý Rạp' : 'Quản Trị Hệ Thống';

  return (
    <div className="flex min-h-screen flex-col bg-[#09090B] text-neutral-100 selection:bg-amber-500 selection:text-neutral-950">
      <SessionLifecycle />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#09090B]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-1.5 px-2 sm:h-20 sm:gap-3 sm:px-4 lg:px-8">
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-4">
            <Link className="group flex shrink-0 items-center gap-2.5 text-left focus:outline-none" href="/" title="Moonlight Cinema">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 shadow-lg shadow-amber-500/20 transition-transform duration-300 group-hover:scale-105 sm:h-10 sm:w-10">
                <svg className="h-5 w-5 fill-current text-neutral-950" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" /></svg>
              </div>
              <div className="flex flex-col">
                <span className="font-display text-base font-extrabold leading-none tracking-tight text-white transition group-hover:text-amber-400 sm:text-lg">MOONLIGHT</span>
                <span className="mt-0.5 font-mono text-[9px] font-semibold uppercase leading-tight tracking-widest text-amber-400/90">CINEMA</span>
              </div>
            </Link>
            {!isAuth || role === 'CUSTOMER' ? (
              <nav className="flex items-center gap-1 sm:gap-1.5">
                {navLinks.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link className={`inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-2 py-1.5 text-xs font-medium transition sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm ${active ? 'bg-white/10 font-semibold text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`} href={item.href} key={item.href}>
                      <span>{item.icon}</span>
                      <span className="hidden sm:inline">{item.label}</span>
                      <span className="sm:hidden">{item.short}</span>
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {isAuth && role !== 'CUSTOMER' ? (
              <Link className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-400 transition hover:bg-amber-500/25 md:inline-flex" href={ROLE_HOME[role]}>
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400" />
                <span>{opsLabel}</span>
              </Link>
            ) : null}

            {isAuth ? (
              <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                <Link className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-[#121215] p-1 transition hover:bg-[#18181D] sm:py-1.5 sm:pl-1.5 sm:pr-2.5" href={ROLE_HOME[role as Exclude<RoleKey, 'GUEST'>]} title="Thông tin tài khoản">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-xs font-black text-neutral-950 shadow-md">{initials}</div>
                  <div className="hidden text-left xl:block">
                    <span className="block max-w-[85px] truncate text-xs font-semibold leading-none text-white">{displayName}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-amber-400/90">{ROLE_TITLES[role as Exclude<RoleKey, 'GUEST'>]}</span>
                  </div>
                </Link>
                <button className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-[#121215] p-2 text-xs font-medium text-neutral-400 transition hover:border-rose-500/30 hover:bg-rose-500/15 hover:text-rose-300" disabled={logoutMutation.isPending} onClick={() => logoutMutation.mutate('/')} title="Đăng xuất khỏi hệ thống" type="button">
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                  <span className="hidden xl:inline">Đăng xuất</span>
                </button>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <Link className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:bg-white/10" href="/login">Đăng Nhập</Link>
                <Link className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-neutral-950 shadow-md shadow-amber-500/20 transition hover:bg-amber-400" href="/register">Đăng Ký</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-20 border-t border-white/10 bg-[#09090B] py-12 text-xs text-neutral-400">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-sm font-black text-neutral-950">🌙</div>
              <span className="font-display text-base font-extrabold tracking-tight text-white">MOONLIGHT CINEMA</span>
            </div>
            <p className="text-xs leading-relaxed text-neutral-400">Hệ thống rạp chiếu phim chuẩn quốc tế với công nghệ IMAX Laser 4K, Dolby Atmos và dịch vụ rạp chiếu VIP Gold Class hàng đầu Việt Nam.</p>
            <p className="font-mono text-[11px] text-neutral-500">Hotline: 1900 8888 (8:00 - 23:00)</p>
          </div>
          <div>
            <h4 className="mb-3 font-display text-xs font-bold uppercase tracking-wider text-white">Cụm Rạp Trọng Điểm</h4>
            <ul className="space-y-2 text-xs">
              <li>Moonlight Saigon Centre (Quận 1)</li>
              <li>Moonlight Landmark 81 (Bình Thạnh)</li>
              <li>Moonlight Crescent Mall (Quận 7)</li>
              <li>Moonlight Thảo Điền (TP. Thủ Đức)</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-display text-xs font-bold uppercase tracking-wider text-white">Chính Sách &amp; Quy Định</h4>
            <ul className="space-y-2 text-xs">
              <li>Quy định độ tuổi xem phim (P, K, T13, T16, T18)</li>
              <li>Chính sách giữ chỗ 5 phút &amp; thanh toán vé</li>
              <li>Điều khoản hoàn tiền khi hủy suất chiếu</li>
              <li>Bảo mật thông tin khách hàng</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-display text-xs font-bold uppercase tracking-wider text-white">Hệ Thống Vận Hành</h4>
            <p className="mb-3 text-xs text-neutral-400">Hệ thống quản lý nội bộ phân quyền chuyên sâu dành cho Soát vé, Quản lý chi nhánh và Quản trị nền tảng toàn quốc.</p>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-7xl border-t border-white/5 px-4 pt-8 text-center text-[11px] text-neutral-600 sm:px-6 lg:px-8">© 2026 MOONLIGHT CINEMA VIETNAM. TẤT CẢ CÁC QUYỀN ĐƯỢC BẢO LƯU.</div>
      </footer>
    </div>
  );
}
