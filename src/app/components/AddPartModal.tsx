'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import {
  X,
  Camera,
  Loader2,
  PackagePlus,
  Trash2,
} from 'lucide-react';
import { compressImage } from '@/app/lib/imageCompressor';

interface AddPartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

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
  'Umum / All Machine'
];

export default function AddPartModal({
  isOpen,
  onClose,
  onSuccess,
}: AddPartModalProps) {
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

  const [stock, setStock] = useState(0);
  const [minStock, setMinStock] = useState(1);
  const [unit, setUnit] = useState('Pcs');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');


  const resetForm = () => {
    setName('');
    setPartNumber('');
    setSku('');
    setAliases('');
    setCategory('');
    setAreaLocation('');
    setRackLocation('');
    setMachineTarget('Umum / All Machine');
    setCondition('BARU');
    setGrade('ORIGINAL');
    setStock(0);
    setMinStock(1);
    setUnit('Pcs');
    setImageFile(null);
    setPreviewUrl(null);
    setErrorMsg('');
  };


  // Reset form saat modal dibuka/ditutup
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }


  const handleClose = () => {
    if (uploading) return;
    resetForm();
    onClose();
  };

  // Handler Pilih / Ambil Foto (Satu Tombol)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    // Maksimal 10 MB (sebelum dikompresi)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Ukuran file foto terlalu besar (maksimal 10 MB).');
      return;
    }

    setErrorMsg('');
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Handler Hapus Foto Preview
  const handleRemoveImage = () => {
    setImageFile(null);
    setPreviewUrl(null);
  };

  // Fungsi Upload Gambar yang Sudah Dikompresi
  const uploadImage = async (file: File): Promise<string> => {
    const fileName = `master_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 10)}.jpg`;

    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('sparepart-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg',
      });

    if (uploadError) {
      throw new Error(
        `Gagal mengunggah foto produk: ${uploadError.message}`
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from('sparepart-images')
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      throw new Error('URL foto produk tidak berhasil dibuat.');
    }

    return publicUrlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (uploading) return;

    setUploading(true);
    setErrorMsg('');

    try {
      // Validasi nama
      if (!name.trim()) {
        throw new Error('Nama barang tidak boleh kosong.');
      }

      // Validasi unit
      if (!unit.trim()) {
        throw new Error('Satuan unit tidak boleh kosong.');
      }

      // Pastikan angka valid
      const finalStock = Number(stock);
      const finalMinStock = Number(minStock);

      if (finalStock < 0) {
        throw new Error('Stok awal tidak boleh kurang dari 0.');
      }

      if (finalMinStock < 0) {
        throw new Error('Minimum stok tidak boleh kurang dari 0.');
      }

      // 🟢 Kompresi Foto ala WhatsApp (1600px, 70%) & Upload jika ada file
      let imageUrl: string | null = null;
      if (imageFile) {
        const compressed = await compressImage(imageFile, 1600, 0.7);
        imageUrl = await uploadImage(compressed);
      }

      // Parsing alias
      const parsedAliases = aliases
        ? aliases
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
        : [];

      // Insert ke database
      const { error: insertError } = await supabase
        .from('spare_parts')
        .insert({
          name: name.trim(),
          part_number: partNumber.trim() || null,
          sku: sku.trim() || null,
          aliases: parsedAliases.length > 0 ? parsedAliases : null,
          category: category.trim() || null,
          area_location: areaLocation.trim() || null,
          rack_location: rackLocation.trim() || null,
          machine_target: machineTarget.trim() || 'Umum / All Machine',
          condition,
          grade,
          stock: finalStock,
          min_stock: finalMinStock,
          unit: unit.trim() || 'Pcs',
          image_url: imageUrl,
        });

      if (insertError) {
        throw new Error(
          `Gagal menyimpan data barang: ${insertError.message}`
        );
      }

      // Berhasil
      alert('Berhasil menambahkan master spare part baru!');
      resetForm();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('AddPartModal error:', err);
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Terjadi kesalahan saat menambahkan barang.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 pt-[max(2rem,env(safe-area-inset-top))] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !uploading) {
          handleClose();
        }
      }}
    >
      <div
        className="relative flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-blue-600">
              <PackagePlus className="h-6 w-6" />
              <h2 className="text-xl font-bold">
                Tambah Master Spare Part Baru
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Masukkan informasi lengkap barang baru ke dalam katalog gudang.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="overflow-y-auto px-6 py-5">
          {/* ERROR */}
          {errorMsg && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <div className="mt-0.5 font-bold">!</div>
              <div>
                <p className="font-semibold">Gagal menyimpan data</p>
                <p className="mt-0.5 text-xs">{errorMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 🟢 UPLOAD FOTO PRODUK (1 TOMBOL KAMERA & GALERI) */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Foto Produk (Opsional)
              </label>

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-500 hover:bg-slate-100">
                <Camera className="h-5 w-5 text-blue-600" />
                <span>{imageFile ? 'Ganti Foto Produk' : 'Ambil Foto / Pilih Galeri'}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>

              {/* PREVIEW FOTO */}
              {previewUrl && (
                <div className="relative mt-3 flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                  <img
                    src={previewUrl}
                    alt="Preview Fisik Part"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={uploading}
                    className="absolute right-2 top-2 rounded-lg bg-slate-900/80 p-1.5 text-white backdrop-blur-sm transition hover:bg-red-600 disabled:opacity-50"
                    title="Hapus Foto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* INFORMASI UTAMA */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <h3 className="mb-4 text-sm font-bold text-slate-700">
                Informasi Spare Part
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* NAMA */}
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Nama Spare Part <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Bearing 6204 ZZ"
                    disabled={uploading}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                  />
                </div>

                {/* PART NUMBER */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Part Number
                  </label>
                  <input
                    type="text"
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    placeholder="Contoh: PN-6204ZZ-SKF"
                    disabled={uploading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                  />
                </div>

                {/* SKU */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Kode SKU
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Contoh: BRG-001"
                    disabled={uploading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                  />
                </div>

                {/* ALIAS */}
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Kata Kunci / Alias Pencarian
                  </label>
                  <input
                    type="text"
                    value={aliases}
                    onChange={(e) => setAliases(e.target.value)}
                    placeholder="Contoh: laher, bantalan peluru, skf"
                    disabled={uploading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Pisahkan beberapa alias dengan koma.
                  </p>
                </div>

                {/* CATEGORY */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Kategori
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Contoh: Bearing"
                    disabled={uploading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                  />
                </div>

                {/* MACHINE / PERUNTUKAN MESIN */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Peruntukan Mesin
                  </label>
                  <select
                    value={machineTarget}
                    onChange={(e) => setMachineTarget(e.target.value)}
                    disabled={uploading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                  >
                    {MASTER_MACHINE_LIST.map((machine) => (
                      <option key={machine} value={machine}>
                        {machine}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* LOKASI */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <h3 className="mb-4 text-sm font-bold text-slate-700">
                Lokasi Gudang
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* AREA */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Area Gudang
                  </label>
                  <input
                    type="text"
                    value={areaLocation}
                    onChange={(e) => setAreaLocation(e.target.value)}
                    placeholder="Contoh: Area A / GDSP"
                    disabled={uploading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                  />
                </div>

                {/* RAK */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Lokasi Rak
                  </label>
                  <input
                    type="text"
                    value={rackLocation}
                    onChange={(e) => setRackLocation(e.target.value)}
                    placeholder="Contoh: Rak B-02"
                    disabled={uploading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* STOK DAN KLASIFIKASI */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <h3 className="mb-4 text-sm font-bold text-slate-700">
                Stok & Klasifikasi
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* STOK */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Stok Awal
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={stock}
                    onChange={(e) =>
                      setStock(
                        Math.max(0, parseInt(e.target.value, 10) || 0)
                      )
                    }
                    disabled={uploading}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                  />
                </div>

                {/* MIN STOCK */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Min. Stok
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minStock}
                    onChange={(e) =>
                      setMinStock(
                        Math.max(0, parseInt(e.target.value, 10) || 0)
                      )
                    }
                    disabled={uploading}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                  />
                </div>

                {/* UNIT */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Satuan Unit
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Pcs / Box / Roll"
                    disabled={uploading}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                  />
                </div>

                {/* CONDITION */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Kondisi
                  </label>
                  <select
                    value={condition}
                    onChange={(e) =>
                      setCondition(e.target.value as 'BARU' | 'BEKAS')
                    }
                    disabled={uploading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                  >
                    <option value="BARU">BARU</option>
                    <option value="BEKAS">BEKAS</option>
                  </select>
                </div>

                {/* GRADE */}
                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Grade Spare Part
                  </label>
                  <select
                    value={grade}
                    onChange={(e) =>
                      setGrade(e.target.value as 'ORIGINAL' | 'PABRIKASI')
                    }
                    disabled={uploading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                  >
                    <option value="ORIGINAL">ORIGINAL</option>
                    <option value="PABRIKASI">PABRIKASI</option>
                  </select>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={uploading}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {uploading ? 'Menyimpan...' : 'Simpan Barang'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}