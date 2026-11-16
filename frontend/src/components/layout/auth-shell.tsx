import type { ReactNode } from 'react';
import Link from 'next/link';
import { AppShell } from './app-shell';
import { MoonlightMark } from './moonlight-brand';

const COPY = {
  login: {
    badge: 'Hệ Thống Đặt Vé 4.0',
    title: 'Trải Nghiệm Điện Ảnh Đẳng Cấp Quốc Tế',
    text: 'Đặt chỗ trực tuyến tiện lợi, xác thực vé QR code trực tiếp tại phòng chiếu và quản trị toàn diện hệ thống rạp.',
    points: [
      ['Vé điện tử QR:', 'Quét vé tại cửa phòng chiếu là vào rạp, không cần xếp hàng nhận vé giấy.'],
      ['Khóa giữ ghế 5 phút:', 'Cơ chế giữ ghế nguyên tử chống tranh chấp ghế thời gian thực.'],
      ['Thanh toán an toàn:', 'Tích hợp cổng VNPay Sandbox, xác nhận đơn hàng tức thì kèm VAT 8%.'],
    ],
  },
  register: {
    badge: 'Gia Nhập Thành Viên',
    title: 'Tạo Tài Khoản Khách Hàng Moonlight',
    text: 'Đăng ký tài khoản nhanh chóng để lưu giữ lịch sử đặt vé, nhận vé điện tử QR code và quản lý giao dịch an toàn.',
    points: [
      ['Lưu trữ vé thông minh:', 'Mọi vé phim và hóa đơn thanh toán đều lưu trong mục "Vé Của Tôi".'],
      ['Chính sách hủy vé linh hoạt:', 'Chủ động yêu cầu hoàn tiền 100% trước 60 phút suất chiếu.'],
      ['Không quảng cáo rác:', 'Giao diện thuần điện ảnh, tôn trọng trải nghiệm của người xem.'],
    ],
  },
} as const;

export function AuthShell({ children, variant = 'login' }: { children: ReactNode; variant?: keyof typeof COPY }) {
  const copy = COPY[variant];
  return (
    <AppShell>
      <div className="flex min-h-[85vh] items-center justify-center px-4 py-8 sm:py-16">
        <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-3xl border border-white/10 bg-[#121215] shadow-2xl shadow-black/90 lg:grid-cols-12">
          <div className="relative flex flex-col justify-between overflow-hidden border-b border-white/10 bg-gradient-to-br from-amber-600/20 via-neutral-900 to-black p-8 sm:p-10 lg:col-span-5 lg:border-b-0 lg:border-r">
            <div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-amber-500/15 blur-3xl" />
            <div className="relative z-10 space-y-6">
              <Link className="flex items-center gap-3" href="/">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 font-bold text-neutral-950 shadow-lg shadow-amber-500/20"><MoonlightMark className="h-6 w-6" /></div>
                <div>
                  <span className="block font-display text-base font-extrabold tracking-tight text-white">MOONLIGHT</span>
                  <span className="block text-[10px] font-bold tracking-[0.2em] text-amber-400">CINEMA PLATFORM</span>
                </div>
              </Link>
              <div>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">{copy.badge}</span>
                <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">{copy.title}</h2>
                <p className="mt-2 text-xs leading-relaxed text-neutral-400">{copy.text}</p>
              </div>
              <div className="space-y-3 pt-2 text-xs">
                {copy.points.map(([strong, text]) => (
                  <div className="flex items-start gap-3" key={strong}>
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs text-amber-400">✓</div>
                    <p className="text-xs text-neutral-300"><strong className="text-white">{strong}</strong> {text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-6 text-[11px] text-neutral-500">
              <span>© 2026 Moonlight Cinema</span>
              <span>An toàn &amp; Bảo mật</span>
            </div>
          </div>
          <div className="flex flex-col justify-between space-y-6 p-8 sm:p-10 lg:col-span-7">{children}</div>
        </div>
      </div>
    </AppShell>
  );
}
