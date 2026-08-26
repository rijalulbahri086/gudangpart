'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  FileText,
  Wrench,
  Check,
  Cpu
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
  sku: string | null;
  aliases: string[] | null;
  stock: number;
  machine_target: string | null;
  image_url: string | null;
}

export default function MachineHistoryPage() {
  const [logs, setLogs] = useState<MachineLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLineFilter, setSelectedLineFilter] = useState<string>('ALL');
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>('ALL');

  // Modal State & Data Part List
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [sparePartsList, setSparePartsList] = useState<SparePartOption[]>([]);
  
  // State untuk Custom Searchable Select di Modal
  const [partSearchQuery, setPartSearchQuery] = useState<string>('');
  const [isPartDropdownOpen, setIsPartDropdownOpen] = useState<boolean>(false);
  const [selectedPart, setSelectedPart] = useState<SparePartOption | null>(null);

  // Form Field Data Manual
  const [manualLine, setManualLine] = useState<string>('Line 4');
  const [manualMachine, setManualMachine] = useState<string>(MACHINE_OPTIONS[0]);
  const [manualQty, setManualQty] = useState<number>(1);
  const [manualDate, setManualDate] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');
  const [manualSubmitting, setManualSubmitting] = useState<boolean>(false);

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

  const fetchSpareParts = useCallback(async () => {
    const { data } = await supabase
      .from('spare_parts')
      .select('id, name, unit, part_number, sku, aliases, stock, machine_target, image_url')
      .order('name', { ascending: true });

    if (data) {
      setSparePartsList(data as SparePartOption[]);
    }
  }, []);

  useEffect(() => {
    checkSession();
    fetchMachineLogs();
    fetchSpareParts();
  }, [checkSession, fetchMachineLogs, fetchSpareParts]);

  useEffect(() => {
    if (isManualModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isManualModalOpen]);

  // Filter Log di Halaman Utama
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

  // Filter Pilihan Spare Part di Modal berdasarkan Nama, PN, SKU, & Alias
  const filteredPartOptions = useMemo(() => {
    const q = partSearchQuery.toLowerCase().trim();
    if (!q) return sparePartsList;

    return sparePartsList.filter((item) => {
      const matchName = item.name.toLowerCase().includes(q);
      const matchPN = item.part_number?.toLowerCase().includes(q) || false;
      const matchSKU = item.sku?.toLowerCase().includes(q) || false;
      const matchAliases = item.aliases?.some((alias) => alias.toLowerCase().includes(q)) || false;

      return matchName || matchPN || matchSKU || matchAliases;
    });
  }, [sparePartsList, partSearchQuery]);

  // Handler Submit Form Data Pergantian
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setManualSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.id) {
        throw new Error('Sesi autentikasi telah berakhir. Silakan login kembali.');
      }

      const validActorId = session.user.id;
      const targetPartId = selectedPart ? selectedPart.id : null;
      const isNoPart = !targetPartId;

      let currentStock = 0;
      if (selectedPart) {
        currentStock = selectedPart.stock || 0;
      }

      const customDate = manualDate ? new Date(manualDate).toISOString() : new Date().toISOString();

      // 1. Insert ke stock_requests
      const { data: reqData, error: reqErr } = await supabase
        .from('stock_requests')
        .insert([
          {
            spare_part_id: targetPartId,
            requester_id: validActorId,
            type: 'KELUAR',
            quantity: isNoPart ? 0 : manualQty,
            notes: manualNotes.trim() || (isNoPart ? 'Maintenance / Cleaning tanpa penggantian part' : 'Pencatatan data pergantian mesin'),
            status: 'APPROVED',
            machine_line: manualLine,
            machine_name: manualMachine,
            created_at: customDate
          }
        ])
        .select('id')
        .single();

      if (reqErr) throw reqErr;

      // 2. Insert ke stock_logs
      const { error: logErr } = await supabase
        .from('stock_logs')
        .insert([
          {
            request_id: reqData.id,
            spare_part_id: targetPartId,
            actor_id: validActorId,
            type: 'KELUAR',
            quantity: isNoPart ? 0 : manualQty,
            stock_before: currentStock,
            stock_after: currentStock,
            machine_line: manualLine,
            machine_name: manualMachine,
            created_at: customDate
          }
        ]);

      if (logErr) throw logErr;

      alert('Catatan pergantian mesin berhasil disimpan!');
      setIsManualModalOpen(false);
      setSelectedPart(null);
      setPartSearchQuery('');
      setManualNotes('');
      setManualDate('');
      fetchMachineLogs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan data.';
      alert(msg);
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
          {/* 🟢 TOMBOL INPUT HANYA MUNCUL JIKA USER SUDAH LOGIN */}
          {isLoggedIn && (
            <button 
              type="button"
              onClick={() => {
                setSelectedPart(null);
                setPartSearchQuery('');
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
                    <th className="py-3.5 px-4">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLogs.map((log) => (
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
                              <Package className="w-4 h-4 text-blue-500 shrink-0" />
                              {log.spare_parts.name}
                            </div>
                            {log.spare_parts.part_number && (
                              <span className="text-[10px] font-mono text-slate-400 block ml-6">
                                PN: {log.spare_parts.part_number}
                              </span>
                            )}
                          </>
                        ) : (
                          <div className="font-semibold text-slate-500 italic flex items-center gap-1.5 text-xs">
                            <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            Tanpa Part (Maintenance/Cleaning)
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-amber-600 text-xs">
                        {log.spare_parts ? `${log.quantity} ${log.spare_parts.unit || 'Pcs'}` : '-'}
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

      {/* MODAL INPUT DATA PERGANTIAN (HANYA DIAKSES JIKA LOGIN) */}
      {isLoggedIn && isManualModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !manualSubmitting) {
              setIsManualModalOpen(false);
              setIsPartDropdownOpen(false);
            }
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative my-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-500" /> Input Data Pergantian
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsManualModalOpen(false);
                  setIsPartDropdownOpen(false);
                }}
                disabled={manualSubmitting}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-50 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Pilih Spare Part (Bisa Ketik Nama / Alias / PN)
                </label>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Ketik nama barang, part number, SKU, atau alias..."
                    value={partSearchQuery}
                    onFocus={() => setIsPartDropdownOpen(true)}
                    onChange={(e) => {
                      setPartSearchQuery(e.target.value);
                      setIsPartDropdownOpen(true);
                    }}
                    disabled={manualSubmitting}
                    className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 transition"
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
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-150">
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
                        <span>-- Tanpa Part (Maintenance / Cleaning) --</span>
                      </div>
                      {!selectedPart && <Check className="w-4 h-4 text-amber-600" />}
                    </div>

                    {filteredPartOptions.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400 text-center">
                        Tidak ada barang cocok dengan "{partSearchQuery}"
                      </div>
                    ) : (
                      filteredPartOptions.map((part) => (
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
                            <div className="flex flex-wrap gap-x-2 text-[10px] text-slate-400 font-mono mt-0.5">
                              {part.part_number && <span>PN: {part.part_number}</span>}
                              {part.sku && <span>SKU: {part.sku}</span>}
                              {part.aliases && part.aliases.length > 0 && (
                                <span className="text-amber-600 italic">({part.aliases.join(', ')})</span>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0 ml-2">
                            <span className="text-[11px] font-bold text-slate-700 block">Stok: {part.stock} {part.unit}</span>
                            <span className="text-[10px] text-purple-600 flex items-center justify-end gap-1 mt-0.5">
                              <Cpu className="w-3 h-3" /> {part.machine_target || 'Umum'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {selectedPart ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {selectedPart.image_url ? (
                        <img src={selectedPart.image_url} alt={selectedPart.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-800 text-xs truncate">{selectedPart.name}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1 font-semibold text-purple-700 truncate">
                          <Cpu className="w-3 h-3 text-purple-600 shrink-0" /> {selectedPart.machine_target || 'Umum / All Machine'}
                        </span>
                        <span>•</span>
                        <span className="shrink-0">Stok: <b>{selectedPart.stock} {selectedPart.unit}</b></span>
                      </div>
                    </div>
                  </div>

                  <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-md shrink-0">
                    Part Terpilih
                  </span>
                </div>
              ) : (
                <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-2.5 flex items-center gap-2 text-amber-800 text-xs font-semibold">
                  <Wrench className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Mode Pekerjaan Tanpa Penggantian Spare Part</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Line</label>
                  <select
                    value={manualLine}
                    onChange={(e) => setManualLine(e.target.value)}
                    disabled={manualSubmitting}
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
                    disabled={manualSubmitting}
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
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Jumlah Pcs</label>
                  <input
                    type="number"
                    min={1}
                    value={manualQty}
                    onChange={(e) => setManualQty(parseInt(e.target.value, 10) || 1)}
                    disabled={manualSubmitting || !selectedPart}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100 disabled:text-slate-400"
                    required={!!selectedPart}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Tanggal Pergantian</label>
                  <input
                    type="datetime-local"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    disabled={manualSubmitting}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Keterangan / Alasan</label>
                <textarea
                  rows={2}
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  disabled={manualSubmitting}
                  placeholder="Misal: Maintenance rutin / cleaning mesin..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsManualModalOpen(false);
                    setIsPartDropdownOpen(false);
                  }}
                  disabled={manualSubmitting}
                  className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition shadow-md shadow-amber-500/20 disabled:opacity-50"
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