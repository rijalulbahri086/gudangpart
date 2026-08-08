'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { X, Camera, Loader2, CheckCircle2 } from 'lucide-react';

interface Item {
  id: string;
  name: string;
  unit: string;
  stock: number;
}

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'MASUK' | 'KELUAR';
  item: Item | null;
  onSuccess: () => void;
}

export default function RequestModal({
  isOpen,
  onClose,
  type,
  item,
  onSuccess,
}: RequestModalProps) {
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setNotes('');
      setImageFile(null);
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const isStockIn = type === 'MASUK';

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `requests/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('sparepart-images')
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(`Gagal mengunggah foto: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('sparepart-images')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    setErrorMsg('');

    try {
      // 1. Ambil session user aktif
      const { data: { session } } = await supabase.auth.getSession();
      let validUserId: string | null = null;

      if (session?.user?.id) {
        // Cek apakah ID dari session Auth terdaftar di tabel users
        const { data: matchedUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();

        if (matchedUser) {
          validUserId = matchedUser.id;
        }
      }

      // 2. Jika ID session tidak terdaftar / belum login, ambil ID user pertama dari tabel users
      if (!validUserId) {
        const { data: fallbackUser } = await supabase
          .from('users')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (fallbackUser) {
          validUserId = fallbackUser.id;
        }
      }

      if (!validUserId) {
        throw new Error('Data pemohon tidak ditemukan di tabel users. Pastikan tabel users di Supabase memiliki minimal 1 baris data!');
      }

      let proofImageUrl: string | null = null;

      if (isStockIn && imageFile) {
        proofImageUrl = await uploadImage(imageFile);
      }

      // 3. Insert ke stock_requests dengan ID yang tervalidasi
      const { error: insertError } = await supabase
        .from('stock_requests')
        .insert({
          spare_part_id: item.id,
          requester_id: validUserId,
          type,
          quantity: Number(quantity),
          notes,
          proof_image_url: proofImageUrl,
          status: 'PENDING',
        });

      if (insertError) {
        throw new Error(`Gagal mengirim request: ${insertError.message}`);
      }

      alert(`Request ${isStockIn ? 'Tambah' : 'Ambil'} Stok berhasil dikirim ke Admin!`);
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga';
      setErrorMsg(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl transition-all">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-1 text-xl font-bold text-slate-800">
          {isStockIn ? '📦 Request Tambah Stok' : '📤 Request Ambil Stok'}
        </h2>

        <p className="mb-4 text-sm text-slate-500">
          Barang:{' '}
          <span className="font-semibold text-slate-700">{item.name}</span>{' '}
          <span className="text-xs text-slate-400">(Sisa: {item.stock} {item.unit})</span>
        </p>

        {errorMsg && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Jumlah ({item.unit})
            </label>
            <input
              type="number"
              min={1}
              max={!isStockIn ? item.stock : undefined}
              value={quantity || ''}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Alasan {isStockIn ? 'Penambahan' : 'Pengambilan'}
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isStockIn
                  ? 'Contoh: Pembongkaran mesin B, barang spare baru...'
                  : 'Contoh: Perbaikan pompa mesin 01...'
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>

          {isStockIn && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Foto Fisik Barang
              </label>

              <div className="relative cursor-pointer rounded-xl border-2 border-dashed border-slate-200 p-4 text-center transition hover:border-blue-400 hover:bg-slate-50">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                />

                <div className="flex flex-col items-center gap-1 text-slate-500">
                  {imageFile ? (
                    <>
                      <CheckCircle2 className="mb-1 h-6 w-6 text-emerald-500" />
                      <span className="text-xs font-semibold text-slate-700">
                        {imageFile.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Klik untuk mengganti foto
                      </span>
                    </>
                  ) : (
                    <>
                      <Camera className="mb-1 h-6 w-6 text-blue-500" />
                      <span className="text-xs font-medium">
                        Klik untuk Ambil Foto / Pilih File
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Format: JPG, PNG, WEBP
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
            >
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploading ? 'Mengirim...' : 'Kirim Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}