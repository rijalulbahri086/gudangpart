'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { X, Camera, Loader2, CheckCircle2, Pencil } from 'lucide-react';

// 🟢 MASTER MESIN UNTUK KATALOG BARANG (Tanpa pembagian A/B)
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
  const [areaLocation, setAreaLocation] = useState('');
  const [rackLocation, setRackLocation] = useState('');
  const [machineTarget, setMachineTarget] = useState('Umum / All Machine');
  const [condition, setCondition] = useState<'BARU' | 'BEKAS'>('BARU');
  const [grade, setGrade] = useState<'ORIGINAL' | 'PABRIKASI'>('ORIGINAL');
  const [stock, setStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(1);
  const [unit, setUnit] = useState('Pcs');
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (item && isOpen) {
      setName(item.name || '');
      setPartNumber(item.part_number || '');
      setSku(item.sku || '');
      setAliases(item.aliases ? item.aliases.join(', ') : '');
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
      setErrorMsg('');
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `master_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('sparepart-images')
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(`Gagal mengunggah foto produk: ${uploadError.message}`);
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
      if (!name.trim()) {
        throw new Error('Nama barang tidak boleh kosong!');
      }

      let imageUrl: string | null = currentImageUrl;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const parsedAliases = aliases
        ? aliases.split(',').map((item) => item.trim()).filter((item) => item.length > 0)
        : [];

      const { error: updateError } = await supabase
        .from('spare_parts')
        .update({
          name: name.trim(),
          part_number: partNumber.trim() || null,
          sku: sku.trim() || null,
          aliases: parsedAliases.length > 0 ? parsedAliases : null,
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
        throw new Error(`Gagal mengupdate data barang: ${updateError.message}`);
      }

      alert('Berhasil memperbarui data master spare part!');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Terjadi kesalahan saat mengupdate barang.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl transition-all">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-1 text-blue-600 font-bold text-xl">
          <Pencil className="w-6 h-6" />
          <h2>Edit Master Spare Part</h2>
        </div>
        <p className="mb-6 text-xs text-slate-500">
          Ubah informasi detail barang di katalog gudang.
        </p>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-600">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* FOTO PRODUK */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Foto Produk
            </label>
            <div className="relative cursor-pointer rounded-xl border-2 border-dashed border-slate-200 p-4 text-center transition hover:border-blue-400 hover:bg-slate-50">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              />
              <div className="flex flex-col items-center gap-1 text-slate-500">
                {imageFile ? (
                  <>
                    <CheckCircle2 className="mb-1 h-6 w-6 text-emerald-500" />
                    <span className="text-xs font-semibold text-slate-700">
                      Foto baru terpilih: {imageFile.name}
                    </span>
                  </>
                ) : currentImageUrl ? (
                  <div className="flex items-center gap-3">
                    <img src={currentImageUrl} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                    <div className="text-left">
                      <span className="text-xs font-medium text-slate-700 block">Foto Saat Ini Tersimpan</span>
                      <span className="text-[10px] text-blue-500">Klik di sini jika ingin mengganti foto</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <Camera className="mb-1 h-6 w-6 text-blue-500" />
                    <span className="text-xs font-medium">Pilih Foto Barang / Ambil Gambar</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* INFORMASI UTAMA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Nama Spare Part <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500"
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
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500"
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
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500"
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
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500"
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
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500"
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
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500"
              />
            </div>

            {/* 🟢 DROPDOWN PERUNTUKAN MESIN */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Peruntukan Mesin
              </label>
              <select
                value={machineTarget}
                onChange={(e) => setMachineTarget(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 bg-white"
              >
                {MASTER_MACHINE_LIST.map((machine) => (
                  <option key={machine} value={machine}>
                    {machine}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SPESIFIKASI STOK & KUALITAS (GRADE) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Stok
              </label>
              <input
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Min. Stok
              </label>
              <input
                type="number"
                min={0}
                value={minStock}
                onChange={(e) => setMinStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Satuan Unit
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Kualitas
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as 'ORIGINAL' | 'PABRIKASI')}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 font-bold outline-none transition focus:border-blue-500 bg-white"
              >
                <option value="ORIGINAL">ORIGINAL</option>
                <option value="PABRIKASI">PABRIKASI</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Kondisi
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as 'BARU' | 'BEKAS')}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 bg-white"
              >
                <option value="BARU">BARU</option>
                <option value="BEKAS">BEKAS</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 shadow-lg shadow-blue-500/25"
            >
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}