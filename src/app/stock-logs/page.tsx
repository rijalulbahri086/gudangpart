'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import { 
  ArrowLeft, 
  History, 
  Search, 
  Package, 
  User, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Loader2,
  FileText
} from 'lucide-react';

interface StockLog {
  id: number;
  type: 'MASUK' | 'KELUAR';
  quantity: number;
  stock_before: number;
  stock_after: number;
  created_at: string;
  spare_parts: {
    id: string;
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
    requester: {
      full_name: string;
      username: string;
    } | null;
  } | null;
}

export default function StockLogsPage() {
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'MASUK' | 'KELUAR'>('ALL');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stock_logs')
        .select(`
          id,
          type,
          quantity,
          stock_before,
          stock_after,
          created_at,
          spare_parts (id, name, unit, part_number),
          actor:users!actor_id (full_name, username),
          stock_requests (
            notes,
            requester:users!requester_id (full_name, username)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLogs((data as unknown as StockLog[]) || []);
    } catch (err: unknown) {
      console.error('Error fetching stock logs:', err instanceof Error ? err.message : err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel('stock_logs_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stock_logs' },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase().trim();
    const matchPartName = log.spare_parts?.name?.toLowerCase().includes(q) || false;
    const matchPartNo = log.spare_parts?.part_number?.toLowerCase().includes(q) || false;
    const matchUser = 
      log.stock_requests?.requester?.full_name?.toLowerCase().includes(q) || 
      log.actor?.full_name?.toLowerCase().includes(q) || 
      false;
    const matchNotes = log.stock_requests?.notes?.toLowerCase().includes(q) || false;

    const matchType = filterType === 'ALL' || log.type === filterType;

    return (!q || matchPartName || matchPartNo || matchUser || matchNotes) && matchType;
  });

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
            <History className="text-blue-600 w-8 h-8" /> Riwayat & Audit Log Stok
          </h1>
          <p className="text-sm text-slate-500">Histori terperinci pergerakan barang masuk dan keluar di gudang</p>
        </div>

        <button 
          type="button"
          onClick={fetchLogs}
          className="flex items-center justify-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition shadow-sm text-sm font-medium self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Log
        </button>
      </header>

      {/* FILTER & PENCARIAN */}
      <div className="max-w-6xl mx-auto mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama barang, petugas, atau alasan..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition ${
              filterType === 'ALL'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Semua ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('MASUK')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition ${
              filterType === 'MASUK'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Stok Masuk
          </button>
          <button
            type="button"
            onClick={() => setFilterType('KELUAR')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition ${
              filterType === 'KELUAR'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Stok Keluar
          </button>
        </div>
      </div>

      {/* TABEL DATA LOG */}
      <main className="max-w-6xl mx-auto">
        {loading && logs.length === 0 ? (
          <div className="text-center py-16 text-slate-500 flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span>Memuat data riwayat transaksi...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-500 shadow-sm p-6">
            <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700 text-lg mb-1">Tidak Ada Catatan Log</h3>
            <p className="text-sm text-slate-400">
              {searchQuery ? 'Tidak ditemukan transaksi yang cocok dengan pencarian.' : 'Belum ada riwayat transaksi barang.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Waktu</th>
                    <th className="py-3.5 px-4">Tipe</th>
                    <th className="py-3.5 px-4">Nama Barang</th>
                    <th className="py-3.5 px-4">Perubahan Stok</th>
                    <th className="py-3.5 px-4">Oleh (Petugas)</th>
                    <th className="py-3.5 px-4">Alasan Request</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLogs.map((log) => {
                    const isMasuk = log.type === 'MASUK';

                    return (
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

                        {/* Tipe Transaksi */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isMasuk 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isMasuk ? (
                              <>
                                <ArrowDownLeft className="w-3.5 h-3.5" /> MASUK
                              </>
                            ) : (
                              <>
                                <ArrowUpRight className="w-3.5 h-3.5" /> KELUAR
                              </>
                            )}
                          </span>
                        </td>

                        {/* Nama Barang (Diperbaiki untuk data manual / luar stok) */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            <Package className="w-4 h-4 text-blue-500 shrink-0" />
                            {log.spare_parts?.name || (
                              log.stock_requests?.notes 
                                ? log.stock_requests.notes.split('|')[0].trim() 
                                : 'Barang Manual'
                            )}
                          </div>
                          {log.spare_parts?.part_number && (
                            <span className="text-[10px] font-mono text-slate-400 block ml-6">
                              PN: {log.spare_parts.part_number}
                            </span>
                          )}
                        </td>

                        {/* Perubahan Stok */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                          <div className="font-bold text-slate-800">
                            <span className={isMasuk ? 'text-emerald-600' : 'text-amber-600'}>
                              {isMasuk ? '+' : '-'}{log.quantity} {log.spare_parts?.unit || 'Pcs'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            Stok: {log.stock_before} ➔ <b>{log.stock_after}</b>
                          </span>
                        </td>

                        {/* Petugas */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-700">
                              {log.stock_requests?.requester?.full_name || log.stock_requests?.requester?.username || log.actor?.full_name || 'Admin'}
                            </span>
                          </div>
                        </td>

                        {/* Alasan Request (Diperbaiki untuk memisahkan teks manual) */}
                        <td className="py-3.5 px-4 text-xs text-slate-500 max-w-xs">
                          <div className="flex items-start gap-1">
                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="italic">
                              {log.spare_parts ? (
                                log.stock_requests?.notes || 'Tanpa catatan.'
                              ) : (
                                log.stock_requests?.notes?.includes('|') 
                                  ? log.stock_requests.notes.split('|')[1].trim() 
                                  : '-'
                              )}
                            </span>
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
    </div>
  );
}