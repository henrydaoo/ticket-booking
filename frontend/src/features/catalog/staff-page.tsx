'use client';

import { useSyncExternalStore } from 'react';
import { readSession, subscribeToSession } from '@/lib/auth/auth-boundary';

export function StaffPage() {
  const session = useSyncExternalStore(subscribeToSession, readSession, () => null);
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-3 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <span className="rounded-md bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold uppercase text-amber-400">Cổng Soát Vé Cửa Phòng Chiếu</span>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-white">Soát Vé QR Tại Rạp</h1>
          <p className="mt-0.5 text-xs text-neutral-400">Nhân viên trực ca: <strong className="text-white">{session?.user.email}</strong></p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-neutral-900 p-6">
        <h2 className="mb-3 font-display text-base font-bold text-white">Quét Mã QR Vé Điện Tử</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input className="flex-1 cursor-not-allowed rounded-xl border border-white/15 bg-neutral-950 px-4 py-3 font-mono text-sm text-white opacity-60" disabled placeholder="Quét hoặc nhập mã QR vé" type="text" />
          <button className="cursor-not-allowed rounded-xl bg-neutral-800 px-6 py-3 text-xs font-bold text-neutral-500" disabled type="button">Quét & Xác Thực Vé</button>
        </div>
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <p className="text-sm font-bold">Chức năng soát vé QR chưa khả dụng</p>
          <p className="mt-1 leading-relaxed text-amber-200/80">Việc phát hành vé điện tử và soát vé thuộc Ticket Service (giai đoạn R3). Cổng này sẽ được kích hoạt khi dịch vụ vé được triển khai.</p>
        </div>
      </div>
    </div>
  );
}
