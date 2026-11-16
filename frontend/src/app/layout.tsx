import type { Metadata } from 'next';
import { QueryProvider } from '@/components/providers/query-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Moonlight Cinema — Nền Tảng Đặt Vé & Trải Nghiệm Điện Ảnh Cao Cấp',
  description: 'Khám phá phim, lịch chiếu và đặt vé xem phim tại Moonlight Cinema.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body><QueryProvider>{children}</QueryProvider></body>
    </html>
  );
}
