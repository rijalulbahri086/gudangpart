'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Settings2, 
  Search, 
  Calendar, 
  User, 
  Package, 
  PlusCircle, 
  RefreshCw, 
  Loader2, 
  X,
  FileText
} from 'lucide-react';

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

interface SparePartOption {
  id: string;
  name: string;
  unit: string;
  part_number: string | null;
}

export default function MachineHistoryPage() {
  const [logs, setLogs] = useState<MachineLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLineFilter, setSelectedLineFilter] = useState<string>('ALL');
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>('ALL');

  // Modal State untuk Input Manual Data Lama
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [sparePartsList, setSparePartsList] = useState<SparePartOption[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const [manualLine, setManualLine] = useState<string>('Line 4');
  const [manualMachine, setManualMachine] = useState<string>(MACHINE_OPTIONS[0]);
  const [manualQty, setManualQty] = useState<number>(1);
  const [manualDate, setManualDate] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');
  const [manualSubmitting, setManualSubmitting] = useState<boolean>(false);

  const fetchMachineLogs = async () => {
    setLoading(true);
    try {
      // Ambil transaksi KELUAR yang memiliki catatan machine_name
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
      if (err instanceof Error) {
        console.error('Error fetching machine history:', err.message);
      } else {
        console.error('Terjadi kesalahan tidak diketahui saat mengambil riwayat mesin.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSpareParts = async () => {
    const { data } = await supabase
      .from('spare_parts')
      .select('id, name, unit, part_number')
      .order('name', { ascending: true });

    if (data && data.length > 0) {
      setSparePartsList(data);
      setSelectedPartId(data[0].id);
    }
  };

  useEffect(() => {
    // 🟢 Memanggil fungsi yang benar secara langsung
    fetchMachineLogs();
    fetchSpareParts();
  }, []);

  // Filter Log berdasarkan Line, Mesin, dan Search Query (Safe Null Checking)
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

  // Handler Submit Manual Data Lama
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartId) return;

    setManualSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      let validActorId = session?.user?.id;
      if (!validActorId) {
        const { data: firstUser } = await supabase.from('users').select('id').limit(1).single();
        validActorId = firstUser?.id;
      }

      // Ambil data stok barang saat ini
      const { data: partData } = await supabase
        .from('spare_parts')
        .select('stock')
        .eq('id', selectedPartId)
        .single();

      const currentStock = partData?.stock || 0;
      const customDate = manualDate ? new Date(manualDate).toISOString() : new Date().toISOString();

      // Insert Request dummy approved
      const { data: reqData, error: reqErr } = await supabase
        .from('stock_requests')
        .insert([
          {
            spare_part_id: selectedPartId,
            requester_id: validActorId,
            type: 'KELUAR',
            quantity: manualQty,
            notes: manualNotes || 'Pencatatan data lama pergantian mesin',
            status: 'APPROVED',
            machine_line: manualLine,
            machine_name: manualMachine,
            created_at: customDate
          }
        ])
        .select('id')
        .single();

      if (reqErr) throw reqErr;

      // Insert Log ke stock_logs
      const { error: logErr } = await supabase
        .from('stock_logs')
        .insert([
          {
            request_id: reqData.id,
            spare_part_id: selectedPartId,
            actor_id: validActorId,
            type: 'KELUAR',
            quantity: manualQty,
            stock_before: currentStock,
            stock_after: currentStock,
            machine_line: manualLine,
            machine_name: manualMachine,
            created_at: customDate
          }
        ]);

      if (logErr) throw logErr;

      alert('Data pergantian mesin lama berhasil disimpan!');
      setIsManualModalOpen(false);
      setManualNotes('');
      setManualDate('');
      fetchMachineLogs();
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(`Gagal menyimpan data manual: ${err.message}`);
      } else {
        alert('Terjadi kesalahan saat menyimpan data.');
      }
    } finally {
      setManualSubmitting(false);
    };
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
          <button 
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl transition shadow-sm text-sm font-semibold"
          >
            <PlusCircle className="w-4 h-4" /> Input Data Lama
          </button>
          
          <button 
            onClick={fetchMachineLogs}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* FILTER & PENCARIAN */}
      <div className="max-w-6xl mx-auto mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Search */}
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

        {/* Filter Line */}
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

        {/* Filter Unit Mesin */}
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
                    <th className="py-3.5 px-4">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      {/* Waktu */}
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap text-slate-500">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(log.created_at).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </div>
                      </td>

                      {/* Line & Mesin */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold mr-2">
                          {log.machine_line || 'Line -'}
                        </span>
                        <span className="font-semibold text-slate-800 text-xs">
                          {log.machine_name || 'Mesin Umum'}
                        </span>
                      </td>

                      {/* Nama Spare Part */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          <Package className="w-4 h-4 text-blue-500 shrink-0" />
                          {log.spare_parts?.name || 'Barang Dihapus'}
                        </div>
                        {log.spare_parts?.part_number && (
                          <span className="text-[10px] font-mono text-slate-400 block ml-6">
                            PN: {log.spare_parts.part_number}
                          </span>
                        )}
                      </td>

                      {/* Jumlah */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-amber-600 text-xs">
                        {log.quantity} {log.spare_parts?.unit || 'Pcs'}
                      </td>

                      {/* Teknisi */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-700">
                            {log.actor?.full_name || log.actor?.username || 'Teknisi'}
                          </span>
                        </div>
                      </td>

                      {/* Keterangan */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 max-w-xs">
                        <div className="flex items-start gap-1">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="italic">{log.stock_requests?.notes || 'Tanpa catatan.'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL INPUT MANUAL DATA LAMA */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-500" /> Input Catatan Masa Lalu
              </h3>
              <button onClick={() => setIsManualModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              {/* Pilih Sparepart */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Pilih Spare Part</label>
                <select
                  value={selectedPartId}
                  onChange={(e) => setSelectedPartId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {sparePartsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.part_number ? `(PN: ${p.part_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Line & Mesin */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Line</label>
                  <select
                    value={manualLine}
                    onChange={(e) => setManualLine(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 truncate"
                  >
                    {MACHINE_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Jumlah & Tanggal */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Jumlah Pcs</label>
                  <input
                    type="number"
                    min={1}
                    value={manualQty}
                    onChange={(e) => setManualQty(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Tanggal Pergantian</label>
                  <input
                    type="datetime-local"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Catatan / Alasan */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Keterangan / Alasan</label>
                <textarea
                  rows={2}
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Misal: Maintenance rutin bulan lalu..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Action */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {manualSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}