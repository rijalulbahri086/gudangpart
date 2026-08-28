'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Settings2, 
  Search, 
  Calendar, 
  User, 
  Wrench, 
  PlusCircle, 
  RefreshCw, 
  Loader2, 
  X,
  FileText,
  Camera,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
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

interface MachineLog {
  id: number;
  created_at: string;
  quantity: number;
  machine_line: string | null;
  machine_name: string | null;
  spare_parts: {
    name: string;
    unit: string;
    part_number: string | null;
  } | null;
  actor: {
    full_name: string;
    username: string;
  } | null;
  stock_requests: {
    notes: string;
  } | null;
}

export default function MachineHistoryPage() {
  const [logs, setLogs] = useState<MachineLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLineFilter, setSelectedLineFilter] = useState<string>('ALL');
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>('ALL');

  // Modal State & Input Manual Form
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [manualLine, setManualLine] = useState<string>('Line 4');
  const [manualMachine, setManualMachine] = useState<string>(MACHINE_OPTIONS[0]);
  const [manualPartName, setManualPartName] = useState<string>(''); 
  const [manualQty, setManualQty] = useState<number>(1);
  const [manualDate, setManualDate] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');

  // State untuk Bukti Foto & Kompresi
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState<boolean>(false);

  // State untuk Modal Preview Foto Full Screen di Tabel
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const [manualSubmitting, setManualSubmitting] = useState<boolean>(false);

  const clearPreview = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    setImageFile(null);
  };

  const checkSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsLoggedIn(!!session);
  }, []);

  const fetchMachineLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stock_logs')
        .select(`
          id,
          created_at,
          quantity,
          machine_line,
          machine_name,
          spare_parts (name, unit, part_number),
          actor:users!actor_id (full_name, username),
          stock_requests (notes)
        `)
        .eq('type', 'KELUAR')
        .not('machine_name', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs((data as unknown as MachineLog[]) || []);
    } catch (err: unknown) {
      console.error('Error fetching machine history:', err instanceof Error ? err.message : err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
    fetchMachineLogs();
  }, [checkSession, fetchMachineLogs]);

  useEffect(() => {
    if (isManualModalOpen || previewPhotoUrl) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isManualModalOpen, previewPhotoUrl]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert('Ukuran file foto terlalu besar (maksimal 25 MB).');
      return;
    }

    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }

    setImagePreview(null);
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

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      log.spare_parts?.name?.toLowerCase().includes(q) ||
      log.spare_parts?.part_number?.toLowerCase().includes(q) ||
      log.actor?.full_name?.toLowerCase().includes(q) ||
      log.stock_requests?.notes?.toLowerCase().includes(q) ||
      false;

    const matchLine = selectedLineFilter === 'ALL' || log.machine_line === selectedLineFilter;
    const matchMachine = selectedMachineFilter === 'ALL' || log.machine_name === selectedMachineFilter;

    return matchSearch && matchLine && matchMachine;
  });

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPartName.trim()) {
      alert('Nama part atau keterangan barang wajib diisi!');
      return;
    }

    if (manualSubmitting || compressing) return;
    setManualSubmitting(true);

    try {
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      
      if (sessionErr || !session?.user?.id) {
        throw new Error('Sesi autentikasi telah berakhir. Silakan login kembali.');
      }

      const authUserId = session.user.id;

      const { data: profileCheck } = await supabase
        .from('users')
        .select('id')
        .eq('id', authUserId)
        .maybeSingle();

      if (!profileCheck) {
        await supabase
          .from('users')
          .insert([
            {
              id: authUserId,
              username: session.user.email?.split('@')[0] || 'teknisi',
              full_name: session.user.user_metadata?.full_name || session.user.email || 'Teknisi Gudang',
              role: 'TEKNISI'
            }
          ]);
      }

      const customDate = manualDate ? new Date(manualDate).toISOString() : new Date().toISOString();
      
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

      let cleanNotes = manualNotes.trim() 
        ? `${manualPartName.trim()} | ${manualNotes.trim()}` 
        : manualPartName.trim();

      if (uploadedImageUrl) {
        cleanNotes += ` | Foto: ${uploadedImageUrl}`;
      }

      const { data: reqData, error: reqErr } = await supabase
        .from('stock_requests')
        .insert([
          {
            spare_part_id: null,
            requester_id: authUserId,
            type: 'KELUAR',
            quantity: manualQty,
            notes: cleanNotes,
            status: 'APPROVED',
            machine_line: manualLine,
            machine_name: manualMachine,
            created_at: customDate
          }
        ])
        .select('id')
        .single();

      if (reqErr) throw new Error(`Gagal membuat request: ${reqErr.message}`);

      const { error: logErr } = await supabase
        .from('stock_logs')
        .insert([
          {
            request_id: reqData.id,
            spare_part_id: null,
            actor_id: authUserId,
            type: 'KELUAR',
            quantity: manualQty,
            stock_before: 0,
            stock_after: 0,
            machine_line: manualLine,
            machine_name: manualMachine,
            created_at: customDate
          }
        ]);

      if (logErr) throw new Error(`Gagal mencatat log stok: ${logErr.message}`);

      alert('Catatan pergantian mesin berhasil disimpan!');
      setIsManualModalOpen(false);
      setManualPartName('');
      setManualQty(1);
      setManualNotes('');
      setManualDate('');
      clearPreview();
      fetchMachineLogs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan data.';
      alert(msg);
      console.error('Submit manual history error:', err);
    } finally {
      setManualSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      {/* HEADER PAGE */}
      <header className="max-w-6xl mx-auto mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link 
            href="/" 
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-blue-600 transition mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Settings2 className="text-amber-500 w-8 h-8" /> Catatan Pergantian Mesin
          </h1>
          <p className="text-sm text-slate-500">Histori terperinci penggantian spare part per unit mesin & Line</p>
        </div>

        <div className="flex items-center gap-2">
          {isLoggedIn && (
            <button 
              type="button"
              onClick={() => {
                clearPreview();
                setIsManualModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl transition shadow-sm text-sm font-semibold"
            >
              <PlusCircle className="w-4 h-4" /> Input Data Pergantian
            </button>
          )}
          
          <button 
            type="button"
            onClick={fetchMachineLogs}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* FILTER & PENCARIAN LOG */}
      <div className="max-w-6xl mx-auto mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari sparepart, petugas, atau catatan..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
          />
        </div>

        <div>
          <select
            value={selectedLineFilter}
            onChange={(e) => setSelectedLineFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
          >
            <option value="ALL">Semua Line (Line 4 & 5)</option>
            <option value="Line 4">Line 4</option>
            <option value="Line 5">Line 5</option>
          </select>
        </div>

        <div>
          <select
            value={selectedMachineFilter}
            onChange={(e) => setSelectedMachineFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm truncate"
          >
            <option value="ALL">Semua Unit Mesin</option>
            {MACHINE_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TABEL CATATAN PERGANTIAN */}
      <main className="max-w-6xl mx-auto">
        {loading ? (
          <div className="text-center py-16 text-slate-500 flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span>Memuat catatan pergantian mesin...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-500 shadow-sm p-6">
            <Settings2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700 text-lg mb-1">Belum Ada Catatan Pergantian</h3>
            <p className="text-sm text-slate-400">
              {searchQuery || selectedLineFilter !== 'ALL' || selectedMachineFilter !== 'ALL'
                ? 'Tidak ditemukan catatan pergantian yang cocok dengan filter.'
                : 'Belum ada histori pergantian part mesin yang terdata.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Waktu Pergantian</th>
                    <th className="py-3.5 px-4">Lokasi & Mesin</th>
                    <th className="py-3.5 px-4">Part yang Diganti</th>
                    <th className="py-3.5 px-4">Jumlah</th>
                    <th className="py-3.5 px-4">Teknisi / Petugas</th>
                    <th className="py-3.5 px-4">Keterangan & Bukti Foto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLogs.map((log) => {
                    const notesRaw = log.stock_requests?.notes || '';
                    const parts = notesRaw.split('|');
                    const partName = log.spare_parts?.name || parts[0]?.trim() || 'Part Manual';
                    
                    const rawNotesText = log.spare_parts ? notesRaw : parts[1]?.trim();
                    const notesText = rawNotesText?.includes('Foto:') ? '' : rawNotesText;
                    
                    const photoUrlMatch = notesRaw.match(/Foto:\s*(https?:\/\/[^\s]+)/);
                    const photoUrl = photoUrlMatch ? photoUrlMatch[1] : null;

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 text-xs whitespace-nowrap text-slate-500">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(log.created_at).toLocaleString('id-ID', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold mr-2">
                            {log.machine_line || 'Line -'}
                          </span>
                          <span className="font-semibold text-slate-800 text-xs">
                            {log.machine_name || 'Mesin Umum'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {log.spare_parts ? (
                            <>
                              <div className="font-bold text-slate-800 flex items-center gap-2">
                                <Wrench className="w-4 h-4 text-blue-500 shrink-0" />
                                {log.spare_parts.name}
                              </div>
                              {log.spare_parts.part_number && (
                                <span className="text-[10px] font-mono text-slate-400 block ml-6">
                                  PN: {log.spare_parts.part_number}
                                </span>
                              )}
                            </>
                          ) : (
                            <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                              <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{partName}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap font-bold text-amber-600 text-xs">
                          {log.quantity > 0 ? `${log.quantity} Pcs` : '-'}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-700">
                              {log.actor?.full_name || log.actor?.username || 'Teknisi'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-500 max-w-xs">
                          <div className="space-y-1.5">
                            {notesText && (
                              <div className="flex items-start gap-1">
                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                <span className="italic">{notesText}</span>
                              </div>
                            )}
                            {photoUrl && (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhotoUrl(photoUrl)}
                                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition border border-amber-200"
                                >
                                  <ImageIcon className="w-3.5 h-3.5 text-amber-600" /> Lihat Bukti Foto
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL INPUT DATA PERGANTIAN MANUAL */}
      {isLoggedIn && isManualModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !manualSubmitting && !compressing) {
              setIsManualModalOpen(false);
            }
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative my-auto max-h-[90vh] overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 sticky top-0 bg-white z-10">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-amber-500" /> Catat Pergantian Manual
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Untuk part di luar stok gudang atau histori terdahulu.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                disabled={manualSubmitting || compressing}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-50 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Nama Spare Part / Barang *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Sensor PNP / V-Belt Custom..."
                  value={manualPartName}
                  onChange={(e) => setManualPartName(e.target.value)}
                  disabled={manualSubmitting || compressing}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Line</label>
                  <select
                    value={manualLine}
                    onChange={(e) => setManualLine(e.target.value)}
                    disabled={manualSubmitting || compressing}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100"
                  >
                    <option value="Line 4">Line 4</option>
                    <option value="Line 5">Line 5</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Unit Mesin</label>
                  <select
                    value={manualMachine}
                    onChange={(e) => setManualMachine(e.target.value)}
                    disabled={manualSubmitting || compressing}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 truncate disabled:bg-slate-100"
                  >
                    {MACHINE_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Jumlah</label>
                  <input
                    type="number"
                    min={1}
                    value={manualQty}
                    onChange={(e) => setManualQty(parseInt(e.target.value, 10) || 1)}
                    disabled={manualSubmitting || compressing}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Tanggal & Waktu</label>
                  <input
                    type="datetime-local"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    disabled={manualSubmitting || compressing}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Keterangan Tambahan / Alasan</label>
                <textarea
                  rows={2}
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  disabled={manualSubmitting || compressing}
                  placeholder="Misal: Part darurat luar / diganti karena aus..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100"
                />
              </div>

              {/* Input Bukti Foto dengan Kompresi Otomatis & Bebas Pilih File/Kamera */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Bukti Foto (Opsional)
                </label>
                <div className="flex flex-col gap-2">
                  {!imagePreview && !compressing && (
                    <label className="border-2 border-dashed border-slate-200 hover:border-amber-500 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer bg-slate-50 transition text-center">
                      <Camera className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs font-medium text-slate-600">
                        Ambil Foto atau Pilih dari Galeri
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageChange}
                        disabled={manualSubmitting || compressing}
                        className="hidden" 
                      />
                    </label>
                  )}

                  {compressing && (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                      <span>Memproses foto...</span>
                    </div>
                  )}

                  {imagePreview && !compressing && (
                    <div className="relative w-full h-36 bg-slate-900 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
                      <img src={imagePreview} alt="Preview Bukti" className="h-full w-full object-contain" />
                      <button
                        type="button"
                        onClick={clearPreview}
                        disabled={manualSubmitting}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-lg shadow-md transition"
                        title="Hapus Foto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex gap-2 sticky bottom-0 bg-white py-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  disabled={manualSubmitting || compressing}
                  className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting || compressing}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {(manualSubmitting || compressing) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {manualSubmitting ? 'Menyimpan...' : compressing ? 'Memproses Foto...' : 'Simpan Catatan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW FOTO FULL SCREEN */}
      {previewPhotoUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewPhotoUrl(null)}
            className="absolute top-4 right-4 z-10 rounded-xl bg-white/10 hover:bg-white/20 p-2 text-white transition"
            title="Tutup Preview"
          >
            <X className="h-6 w-6" />
          </button>
          
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <img
              src={previewPhotoUrl}
              alt="Bukti Foto Pergantian"
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}