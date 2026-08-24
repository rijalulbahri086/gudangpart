'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { X, Loader2, Settings2, Camera, Trash2 } from 'lucide-react';
import { compressImage } from '@/app/lib/imageCompressor'; // Helper kompresi gambar

interface Item {
  id: string;
  name: string;
  unit: string;
  stock: number;
}

const REQUEST_MACHINE_UNITS = [
  'Dumper',
  'Blowing',
  'Filling',
  'Camera Inspection',
  'Conveyor Buffer',
  'Air Knife A',
  'Air Knife B',
  'Label A',
  'Label B',
  'Dasessing A',
  'Dasessing B',
  'Shrink Tunnel A Zona 1',
  'Shrink Tunnel A Zona 2',
  'Shrink Tunnel B Zona 1',
  'Shrink Tunnel B Zona 2',
  'Camera Label Capseal A',
  'Camera Label Capseal B',
  'Autopacker A',
  'Autopacker B',
  'Ringpack A',
  'Ringpack B',
  'Packing Tape',
  'Palletizer'
] as const;

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
  const [uploading, setUploading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [machineLine, setMachineLine] = useState<string>('Line 4');
  const [machineName, setMachineName] = useState<string>(REQUEST_MACHINE_UNITS[0]);

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setNotes('');
      setProofFile(null);
      setPreviewUrl(null);
      setErrorMsg('');
      setMachineLine('Line 4');
      setMachineName(REQUEST_MACHINE_UNITS[0]);
    }
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const isStockIn = type === 'MASUK';

  // Handler Pilih / Ambil Foto
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  // Handler Hapus Foto Preview
  const handleRemoveImage = () => {
    setProofFile(null);
    setPreviewUrl(null);
  };

  // Fungsi Upload dengan Menerima File Terkompresi
  const uploadProofImage = async (file: File): Promise<string | null> => {
    const fileName = `proofs/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

    const { data, error } = await supabase.storage
      .from('sparepart-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg'
      });

    if (error) {
      throw new Error(`Gagal mengunggah foto bukti: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('sparepart-images')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    setErrorMsg('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      let validUserId: string | null = null;

      if (session?.user?.id) {
        const { data: matchedUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();

        if (matchedUser) {
          validUserId = matchedUser.id;
        }
      }

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
        throw new Error('Data pemohon tidak ditemukan di tabel users.');
      }

      let uploadedImageUrl: string | null = null;

      // 🟢 1. PENYIMPANAN KOMPRESI GAMBAR SEBELUM UPLOAD (MODE WHATSAPP 1600px 70%)
      if (proofFile) {
        const compressed = await compressImage(proofFile, 1600, 0.7);
        uploadedImageUrl = await uploadProofImage(compressed);
      }

      // 🟢 2. PENYIMPANAN DATA DENGAN MACHINE_LINE & MACHINE_NAME DI KEDUA TIPE
      const { error: insertError } = await supabase
        .from('stock_requests')
        .insert([
          {
            spare_part_id: item.id,
            requester_id: validUserId,
            type,
            quantity: quantity,
            notes,
            proof_image_url: uploadedImageUrl,
            status: 'PENDING',
            machine_line: machineLine,
            machine_name: machineName,
          },
        ]);

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
          {/* JUMLAH */}
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

          {/* 🟢 BLOK PILIHAN MESIN */}
          <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-3">
            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
              <Settings2 className="w-4 h-4 text-amber-600" />
              <span>{isStockIn ? 'Mesin Asal Barang' : 'Target Pergantian Mesin'}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Pilihan Line */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Lokasi Line <span className="text-red-500">*</span>
                </label>
                <select
                  value={machineLine}
                  onChange={(e) => setMachineLine(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Line 4">Line 4</option>
                  <option value="Line 5">Line 5</option>
                </select>
              </div>

              {/* Pilihan Nama Mesin */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Unit Mesin <span className="text-red-500">*</span>
                </label>
                <select
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 truncate"
                >
                  {REQUEST_MACHINE_UNITS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ALASAN */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Alasan {isStockIn ? 'Penambahan' : 'Pengambilan'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isStockIn
                  ? 'Contoh: Pembongkaran mesin B, barang spare baru...'
                  : 'Contoh: Perbaikan pergantian part mesin...'
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>

          {/* 🟢 UPLOAD FOTO BUKTI (1 TOMBOL SERBAGUNA UNTUK KAMERA & GALERI) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Foto Bukti / Fisik Barang {isStockIn ? '(Sangat Dianjurkan)' : '(Opsional)'}
            </label>

            <label className="flex items-center justify-center gap-2 p-3 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer transition shadow-sm border-dashed hover:border-blue-500">
              <Camera className="w-4 h-4 text-blue-600" />
              <span>{proofFile ? 'Ganti Foto' : 'Ambil Foto / Pilih Galeri'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            {/* PREVIEW FOTO */}
            {previewUrl && (
              <div className="relative mt-2 rounded-xl overflow-hidden border border-slate-200 h-36 bg-slate-900 flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Preview Bukti"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 bg-slate-900/80 hover:bg-red-600 text-white p-1.5 rounded-lg backdrop-blur-sm transition"
                  title="Hapus Foto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* TOMBOL ACTION */}
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