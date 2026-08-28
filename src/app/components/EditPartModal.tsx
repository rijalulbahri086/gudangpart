'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { X, Camera, Loader2, Pencil, Trash2 } from 'lucide-react';
import { compressImage } from '@/app/lib/imageCompressor';

const MASTER_MACHINE_LIST = [
  'Dumper',
  'Blowing',
  'Filling',
  'Camera Inspection',
  'Conveyor Buffer',
  'Air Knife',
  'Label',
  'Dasessing',
  'Shrink Tunnel',
  'Camera Label Capseal',
  'Autopacker',
  'Ringpack',
  'Packing Tape',
  'Palletizer',
  'Umum / All Machine',
];

interface SparePart {
  id: string;
  sku: string | null;
  part_number: string | null;
  name: string;
  aliases: string[] | null;
  category: string | null;
  area_location: string | null;
  rack_location: string | null;
  machine_target: string;
  condition: 'BARU' | 'BEKAS';
  grade: 'ORIGINAL' | 'PABRIKASI';
  stock: number;
  min_stock: number;
  unit: string;
  image_url: string | null;
}

interface EditPartModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: SparePart | null;
  onSuccess: () => void;
}

export default function EditPartModal({ isOpen, onClose, item, onSuccess }: EditPartModalProps) {
  const [name, setName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [sku, setSku] = useState('');
  const [aliases, setAliases] = useState('');
  const [category, setCategory] = useState('');
  const [areaLocation, setAreaLocation] = useState('');
  const [rackLocation, setRackLocation] = useState('');
  const [machineTarget, setMachineTarget] = useState('Umum / All Machine');
  const [condition, setCondition] = useState<'BARU' | 'BEKAS'>('BARU');
  const [grade, setGrade] = useState<'ORIGINAL' | 'PABRIKASI'>('ORIGINAL');
  const [stock, setStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(1);
  const [unit, setUnit] = useState('Pcs');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const clearPreviewUrl = useCallback(() => {
    setPreviewUrl(null);
  }, []);

  useEffect(() => {
    if (item && isOpen) {
      setName(item.name || '');
      setPartNumber(item.part_number || '');
      setSku(item.sku || '');
      setAliases(item.aliases ? item.aliases.join(', ') : '');
      setCategory(item.category || '');
      setAreaLocation(item.area_location || '');
      setRackLocation(item.rack_location || '');
      setMachineTarget(item.machine_target || 'Umum / All Machine');
      setCondition(item.condition || 'BARU');
      setGrade(item.grade || 'ORIGINAL');
      setStock(item.stock || 0);
      setMinStock(item.min_stock || 1);
      setUnit(item.unit || 'Pcs');
      setCurrentImageUrl(item.image_url || null);
      setImageFile(null);
      clearPreviewUrl();
      setErrorMsg('');
    }
  }, [item, isOpen, clearPreviewUrl]);

  if (!isOpen || !item) return null;

  const handleClose = () => {
    if (uploading || compressing) return;
    clearPreviewUrl();
    onClose();
  };

  // 🟢 PILIH FILE, KOMPRESI OTOMATIS, DAN BUAT PREVIEW BESAR
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('Ukuran file terlalu besar (maksimal 25 MB).');
      return;
    }

    setErrorMsg('');
    setCompressing(true);

    try {
      // 1. Kompresi gambar menggunakan fungsi compressImage dari proyek
      const compressedFile = await compressImage(file);
      setImageFile(compressedFile);

      // 2. Buat URL preview dari file hasil kompresi agar tampil besar
      const blobUrl = URL.createObjectURL(compressedFile);
      setPreviewUrl(blobUrl);
    } catch (err) {
      console.warn('Gagal kompresi, menggunakan file asli:', err);
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } finally {
      setCompressing(false);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fileName = `master_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.jpg`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('sparepart-images').upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });

    if (uploadError) {
      throw new Error(`Gagal mengunggah foto: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from('sparepart-images').getPublicUrl(filePath);
    return publicUrlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    setErrorMsg('');

    try {
      if (!name.trim()) throw new Error('Nama barang tidak boleh kosong!');

      let imageUrl: string | null = currentImageUrl;

      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const parsedAliases = aliases
        ? aliases
            .split(',')
            .map((i) => i.trim())
            .filter((i) => i.length > 0)
        : [];

      const { error: updateError } = await supabase
        .from('spare_parts')
        .update({
          name: name.trim(),
          part_number: partNumber.trim() || null,
          sku: sku.trim() || null,
          aliases: parsedAliases.length > 0 ? parsedAliases : null,
          category: category.trim() || null,
          area_location: areaLocation.trim() || null,
          rack_location: rackLocation.trim() || null,
          machine_target: machineTarget || 'Umum / All Machine',
          condition,
          grade,
          stock: Number(stock),
          min_stock: Number(minStock),
          unit: unit.trim() || 'Pcs',
          image_url: imageUrl,
        })
        .eq('id', item.id);

      if (updateError) {
        throw new Error(`Gagal memperbarui data: ${updateError.message}`);
      }

      alert('Berhasil memperbarui data master spare part!');
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat mengupdate barang.';
      setErrorMsg(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 pt-[max(2rem,env(safe-area-inset-top))] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !uploading && !compressing) handleClose();
      }}
    >
      <div
        className="relative flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-lg">
            <Pencil className="w-5 h-5" />
            <h2>Edit Master Spare Part</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading || compressing}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-4">
          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-600">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 🟢 FOTO PRODUK & PREVIEW BESAR */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Foto Produk
              </label>

              <div className="space-y-2">
                {/* Kotak Preview Diperbesar (Lebar Penuh, Tinggi 48) */}
                <div className="relative h-48 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 flex items-center justify-center shadow-inner">
                  {(previewUrl || currentImageUrl) ? (
                    <img
                      src={previewUrl || currentImageUrl!}
                      alt="Preview Produk"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-400 text-xs">
                      <Camera className="h-8 w-8" />
                      <span>Belum ada foto</span>
                    </div>
                  )}

                  {compressing && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center text-white text-xs gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                      <span>Mengompresi foto...</span>
                    </div>
                  )}
                </div>

                {/* Tombol Aksi Foto */}
                <div className="flex items-center justify-between gap-2">
                  <label className="flex-1 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100">
                    <Camera className="h-4 w-4 text-blue-600" />
                    <span>{compressing ? 'Memproses...' : 'Pilih / Ambil Foto Baru'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploading || compressing}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>

                  {(previewUrl || currentImageUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        clearPreviewUrl();
                        setCurrentImageUrl(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" /> Hapus Foto
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* FORM INPUT TEKS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Nama Spare Part <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={uploading || compressing}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 disabled:bg-slate-100"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Part Number
                </label>
                <input
                  type="text"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  disabled={uploading || compressing}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Kode SKU
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  disabled={uploading || compressing}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 disabled:bg-slate-100"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Kata Kunci / Alias Pencarian
                </label>
                <input
                  type="text"
                  value={aliases}
                  onChange={(e) => setAliases(e.target.value)}
                  placeholder="laher, bearing, roda (pisahkan dengan koma)"
                  disabled={uploading || compressing}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 disabled:bg-slate-100"
                />
              </div>
            </div>

            {/* LOKASI & MESIN */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Area Gudang
                </label>
                <input
                  type="text"
                  value={areaLocation}
                  onChange={(e) => setAreaLocation(e.target.value)}
                  disabled={uploading || compressing}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Lokasi Rak
                </label>
                <input
                  type="text"
                  value={rackLocation}
                  onChange={(e) => setRackLocation(e.target.value)}
                  disabled={uploading || compressing}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Peruntukan Mesin
                </label>
                <select
                  value={machineTarget}
                  onChange={(e) => setMachineTarget(e.target.value)}
                  disabled={uploading || compressing}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 bg-white disabled:bg-slate-100"
                >
                  {MASTER_MACHINE_LIST.map((machine) => (
                    <option key={machine} value={machine}>
                      {machine}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* STOK & KONDISI */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Stok</label>
                <input
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  disabled={uploading || compressing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 disabled:bg-slate-100"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Min. Stok</label>
                <input
                  type="number"
                  min={0}
                  value={minStock}
                  onChange={(e) => setMinStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  disabled={uploading || compressing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 disabled:bg-slate-100"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Satuan</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  disabled={uploading || compressing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 disabled:bg-slate-100"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Grade</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value as 'ORIGINAL' | 'PABRIKASI')}
                  disabled={uploading || compressing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 font-bold outline-none transition focus:border-blue-500 bg-white disabled:bg-slate-100"
                >
                  <option value="ORIGINAL">ORIGINAL</option>
                  <option value="PABRIKASI">PABRIKASI</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Kondisi</label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as 'BARU' | 'BEKAS')}
                  disabled={uploading || compressing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 bg-white disabled:bg-slate-100"
                >
                  <option value="BARU">BARU</option>
                  <option value="BEKAS">BEKAS</option>
                </select>
              </div>
            </div>

            {/* TOMBOL AKSI */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading || compressing}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={uploading || compressing}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-500/25"
              >
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                {uploading ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}