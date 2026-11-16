import type { Showtime } from '@/lib/catalog/catalog-client';

export const fmtVnd = (value?: number) => (value ? `${new Intl.NumberFormat('vi-VN').format(value)}đ` : 'Đang cập nhật');
export const fmtDuration = (minutes: number) => `${Math.floor(minutes / 60)}g ${minutes % 60}p`;
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
export const startingPrice = (showtime: Pick<Showtime, 'prices'>) => showtime.prices?.STANDARD ?? Math.min(...Object.values(showtime.prices ?? {}));

const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function buildDates(count = 5) {
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const value = dateKey(date);
    return {
      value,
      label: offset === 0 ? 'Hôm nay' : offset === 1 ? 'Ngày mai' : WEEKDAYS[date.getDay()],
      dayNum: `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`,
    };
  });
}

export function dayRange(day: string) {
  return { from: `${day}T00:00:00+07:00`, to: `${day}T23:59:59+07:00` };
}
