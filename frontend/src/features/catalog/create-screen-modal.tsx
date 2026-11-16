'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError } from '@/lib/api-client/client';
import type { Branch, SeatType } from '@/lib/catalog/catalog-client';
import { useCreateScreenMutation, useUpdateScreenLayoutMutation, useUpdateScreenPricesMutation } from '@/lib/catalog/catalog-queries';
import { OPS_INPUT, OPS_LABEL, OpsModal } from './ops-ui';

const schema = z.object({
  branchId: z.string().min(1, 'Vui lòng chọn chi nhánh.'),
  name: z.string().trim().min(1, 'Vui lòng nhập tên phòng chiếu.'),
  rows: z.number().int().min(4).max(15),
  cols: z.number().int().min(6).max(18),
  vipRows: z.string(),
  coupleRows: z.string(),
  priceStandard: z.number().int().positive(),
  priceVip: z.number().int().positive(),
  priceCouple: z.number().int().positive(),
});
type Values = z.infer<typeof schema>;

const letters = (value: string) => value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean);

export function CreateScreenModal({ branches, defaultBranchId, onClose }: { branches: Branch[]; defaultBranchId?: string; onClose: () => void }) {
  const [error, setError] = useState('');
  const createScreen = useCreateScreenMutation();
  const updateLayout = useUpdateScreenLayoutMutation();
  const updatePrices = useUpdateScreenPricesMutation();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { branchId: defaultBranchId ?? branches[0]?.id ?? '', name: '', rows: 8, cols: 10, vipRows: 'E, F', coupleRows: 'H', priceStandard: 120000, priceVip: 160000, priceCouple: 320000 },
  });

  const submit = form.handleSubmit(async (values) => {
    setError('');
    try {
      const rowLabels = Array.from({ length: values.rows }, (_, index) => String.fromCharCode(65 + index));
      const vip = letters(values.vipRows);
      const couple = letters(values.coupleRows);
      const screen = await createScreen.mutateAsync({ branchId: values.branchId, name: values.name, capacity: values.rows * values.cols });
      const seats = rowLabels.flatMap((row) => Array.from({ length: values.cols }, (_, index) => ({
        label: `${row}${index + 1}`,
        row,
        number: index + 1,
        type: (couple.includes(row) ? 'COUPLE' : vip.includes(row) ? 'VIP' : 'STANDARD') as SeatType,
      })));
      await updateLayout.mutateAsync({ id: screen.id, seats });
      await updatePrices.mutateAsync({ id: screen.id, prices: [{ seatType: 'STANDARD', priceVnd: values.priceStandard }, { seatType: 'VIP', priceVnd: values.priceVip }, { seatType: 'COUPLE', priceVnd: values.priceCouple }] });
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Không thể tạo phòng chiếu. Vui lòng thử lại.');
    }
  });
  const busy = createScreen.isPending || updateLayout.isPending || updatePrices.isPending;
  const err = (name: keyof Values) => form.formState.errors[name]?.message;

  return (
    <OpsModal eyebrow="Quản lý cơ sở vật chất" onClose={onClose} title="Tạo Phòng Chiếu & Sinh Dữ Liệu Ghế">
      <form className="mt-5 space-y-4 text-xs" onSubmit={submit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={OPS_LABEL}>Chi nhánh trực thuộc</label>
            <select className={OPS_INPUT} {...form.register('branchId')}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
            {err('branchId') ? <span className="text-rose-300">{err('branchId')}</span> : null}
          </div>
          <div>
            <label className={OPS_LABEL}>Tên phòng chiếu</label>
            <input className={OPS_INPUT} placeholder="Phòng 3 · Dolby Atmos" type="text" {...form.register('name')} />
            {err('name') ? <span className="text-rose-300">{err('name')}</span> : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><label className={OPS_LABEL}>Số hàng ghế</label><input className={OPS_INPUT} max={15} min={4} type="number" {...form.register('rows', { valueAsNumber: true })} /></div>
          <div><label className={OPS_LABEL}>Số ghế mỗi hàng</label><input className={OPS_INPUT} max={18} min={6} type="number" {...form.register('cols', { valueAsNumber: true })} /></div>
          <div><label className={OPS_LABEL}>Hàng ghế VIP</label><input className={OPS_INPUT} placeholder="E, F" type="text" {...form.register('vipRows')} /></div>
          <div><label className={OPS_LABEL}>Hàng ghế Couple</label><input className={OPS_INPUT} placeholder="H" type="text" {...form.register('coupleRows')} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div><label className={OPS_LABEL}>Giá Standard (₫)</label><input className={OPS_INPUT} step={5000} type="number" {...form.register('priceStandard', { valueAsNumber: true })} /></div>
          <div><label className={OPS_LABEL}>Giá VIP (₫)</label><input className={OPS_INPUT} step={5000} type="number" {...form.register('priceVip', { valueAsNumber: true })} /></div>
          <div><label className={OPS_LABEL}>Giá Couple (₫)</label><input className={OPS_INPUT} step={5000} type="number" {...form.register('priceCouple', { valueAsNumber: true })} /></div>
        </div>
        {error ? <div className="rounded-xl border border-rose-500/40 bg-rose-950/80 p-3 text-rose-200" role="alert">{error}</div> : null}
        <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
          <button className="rounded-xl bg-white/5 px-4 py-2.5 font-semibold text-neutral-300" onClick={onClose} type="button">Hủy</button>
          <button className="rounded-xl bg-amber-500 px-5 py-2.5 font-bold text-neutral-950 hover:bg-amber-400 disabled:opacity-60" disabled={busy} type="submit">{busy ? 'Đang tạo...' : 'Tạo & Seed Dữ Liệu Ghế'}</button>
        </div>
      </form>
    </OpsModal>
  );
}
