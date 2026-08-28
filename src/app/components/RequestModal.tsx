'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/app/lib/supabase';
import { X, Loader2, Package, Wrench, Search, Check, Cpu, Camera, Trash2 } from 'lucide-react';
import { compressImage } from '@/app/lib/imageCompressor';

const MACHINE_OPTIONS = [
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
];

interface SparePart {
  id: string;
  name: string;
  unit: string;
  part_number: string | null;
  sku: string | null;
  aliases: string[] | null;
  stock: number;
  machine_target: string | null;
  image_url: string | null;
}

interface RequestModalProps {
  isOpen: boolean;
  item: SparePart | null;
  type: 'MASUK' | 'KELUAR';
  onClose: () => void;
  onSuccess: () => void;
}

export default function RequestModal({ isOpen, item, type, onClose, onSuccess }: RequestModalProps) {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Form Fields
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [machineLine, setMachineLine] = useState<string>('Line 4');
  const [machineName, setMachineName] = useState<string>(MACHINE_OPTIONS[0]);

  // State Bukti Foto & Kompresi
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState<boolean>(false);

  // State pilihan part
  const [sparePartsList, setSparePartsList] = useState<SparePart[]>([]);
  const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);
  const [partSearchQuery, setPartSearchQuery] = useState<string>('');
  const [isPartDropdownOpen, setIsPartDropdownOpen] = useState<boolean>(false);

  // Bersihkan Blob URL preview untuk mencegah memory leak
  const clearPreview = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    setImageFile(null);
  };

  useEffect(() => {
    if (isOpen) {
      const fetchParts = async () => {
        const { data } = await supabase
          .from('spare_parts')
          .select('id, name, unit, part_number, sku, aliases, stock, machine_target, image_url')
          .order('name', { ascending: true });
        if (data) setSparePartsList(data as SparePart[]);
      };
      fetchParts();

      if (item) {
        setSelectedPart(item);
        setPartSearchQuery(item.name);
      } else {
        setSelectedPart(null);
        setPartSearchQuery('');
      }
      setQuantity(1);
      setNotes('');
      setErrorMsg('');
      clearPreview();
    }
  }, [isOpen, item]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('Ukuran file foto terlalu besar (maksimal 25 MB).');
      return;
    }

    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }

    setImagePreview(null);
    setErrorMsg('');
    setCompressing(true);

    try {
      const compressedFile = await compressImage(file, 1600, 0.7);
      setImageFile(compressedFile);
      setImagePreview(URL.createObjectURL(compressedFile));
    } catch (err) {
      console.warn('Gagal kompresi otomatis, menggunakan file asli:', err);
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    } finally {
      setCompressing(false);
    }
  };

  const filteredPartOptions = useMemo(() => {
    const q = partSearchQuery.toLowerCase().trim();
    if (!q) return sparePartsList;
    return sparePartsList.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.part_number?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.aliases?.some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [sparePartsList, partSearchQuery]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || compressing) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !session?.user?.id) {
        throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
      }

      const authUserId = session.user.id;
      const targetPartId = selectedPart ? selectedPart.id : null;
      const isNoPart = !targetPartId;

      if (!isNoPart && selectedPart) {
        if (quantity <= 0) throw new Error('Jumlah pengambilan minimal 1.');
        if (quantity > selectedPart.stock) {
          throw new Error(`Stok tidak mencukupi! Sisa stok saat ini: ${selectedPart.stock} ${selectedPart.unit}`);
        }
      }

      let uploadedImageUrl = null;
      if (imageFile) {
        const fileName = `proof_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.jpg`;
        const filePath = `proofs/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('sparepart-images')
          .upload(filePath, imageFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/jpeg',
          });

        if (uploadErr) {
          throw new Error(`Gagal mengunggah foto bukti: ${uploadErr.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from('sparepart-images')
          .getPublicUrl(filePath);

        uploadedImageUrl = publicUrlData.publicUrl;
      }

      let finalNotes = notes.trim() || (isNoPart ? 'Maintenance / Cleaning tanpa penggantian part' : 'Pengambilan part untuk pergantian mesin');
      if (uploadedImageUrl) {
        finalNotes += ` | Foto: ${uploadedImageUrl}`;
      }

      const { error: reqErr } = await supabase
        .from('stock_requests')
        .insert([
          {
            spare_part_id: targetPartId,
            requester_id: authUserId,
            type: type,
            quantity: isNoPart ? 0 : quantity,
            notes: finalNotes,
            status: 'PENDING',
            machine_line: machineLine,
            machine_name: machineName,
          }
        ]);

      if (reqErr) throw new Error(`Gagal mengirim request: ${reqErr.message}`);

      alert('Request pengambilan part berhasil dikirim! Menunggu persetujuan (approval) Admin.');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting && !compressing) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative my-auto max-h-[90vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" /> Form Pengambilan Part & Mesin
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || compressing}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50 p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Pilih Spare Part / Material
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama barang, PN, SKU, atau alias..."
                value={partSearchQuery}
                onFocus={() => setIsPartDropdownOpen(true)}
                onChange={(e) => {
                  setPartSearchQuery(e.target.value);
                  setIsPartDropdownOpen(true);
                }}
                disabled={submitting || compressing}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              {selectedPart && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPart(null);
                    setPartSearchQuery('');
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {isPartDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto divide-y divide-slate-100">
                <div
                  onClick={() => {
                    setSelectedPart(null);
                    setPartSearchQuery('');
                    setIsPartDropdownOpen(false);
                  }}
                  className={`p-2.5 text-xs font-semibold cursor-pointer transition flex items-center justify-between ${
                    !selectedPart ? 'bg-amber-50 text-amber-800 font-bold' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-500" />
                    <span>-- Part tidak ada di stok (Maintenance / Cleaning) --</span>
                  </div>
                  {!selectedPart && <Check className="w-4 h-4 text-amber-600" />}
                </div>

                {filteredPartOptions.map((part) => (
                  <div
                    key={part.id}
                    onClick={() => {
                      setSelectedPart(part);
                      setPartSearchQuery(part.name);
                      setIsPartDropdownOpen(false);
                    }}
                    className={`p-2.5 text-xs cursor-pointer transition flex items-center justify-between ${
                      selectedPart?.id === part.id ? 'bg-blue-50 text-blue-800 font-bold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <span className="font-bold block text-slate-800">{part.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">PN: {part.part_number || '-'} | Stok: {part.stock} {part.unit}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                      {part.machine_target || 'Umum'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedPart ? (
            <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white border border-blue-200 overflow-hidden shrink-0 flex items-center justify-center">
                {selectedPart.image_url ? (
                  <img src={selectedPart.image_url} alt={selectedPart.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-5 h-5 text-blue-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800 text-xs truncate">{selectedPart.name}</h4>
                <p className="text-[10px] text-slate-500">Sisa Stok: <b className="text-blue-700">{selectedPart.stock} {selectedPart.unit}</b></p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2 text-amber-800 text-xs font-semibold">
              <Wrench className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Part tidak ada di stok (Pekerjaan Maintenance / Cleaning)</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Line Mesin</label>
              <select
                value={machineLine}
                onChange={(e) => setMachineLine(e.target.value)}
                disabled={submitting || compressing}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Line 4">Line 4</option>
                <option value="Line 5">Line 5</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Unit Mesin</label>
              <select
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
                disabled={submitting || compressing}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 truncate"
              >
                {MACHINE_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Jumlah Pengambilan</label>
              <input
                type="number"
                min={1}
                max={selectedPart ? selectedPart.stock : 1}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                disabled={submitting || compressing || !selectedPart}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400 font-bold"
                required={!!selectedPart}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Keterangan / Keperluan</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Perbaikan sensor / Ganti bearing aus"
                disabled={submitting || compressing}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* BUKTI FOTO (OPSIONAL) DENGAN PILIHAN BEBAS (KAMERA / GALERI) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Bukti Foto Kondisi / Mesin (Opsional)
            </label>
            <div className="flex flex-col gap-2">
              {!imagePreview && !compressing && (
                <label className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer bg-slate-50 transition text-center">
                  <Camera className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-xs font-medium text-slate-600">
                    Ambil Foto atau Pilih dari Galeri
                  </span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageChange}
                    disabled={submitting || compressing}
                    className="hidden" 
                  />
                </label>
              )}

              {compressing && (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span>Memproses foto...</span>
                </div>
              )}

              {imagePreview && !compressing && (
                <div className="relative w-full h-32 bg-slate-900 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
                  <img src={imagePreview} alt="Preview Bukti" className="h-full w-full object-contain" />
                  <button
                    type="button"
                    onClick={clearPreview}
                    disabled={submitting}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-lg shadow-md transition"
                    title="Hapus Foto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 flex gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || compressing}
              className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 transition disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || compressing}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              {(submitting || compressing) && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Mengirim...' : compressing ? 'Memproses Foto...' : 'Kirim Request (Approval)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}