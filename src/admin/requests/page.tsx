'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { 
  Check, 
  X, 
  Clock, 
  Package, 
  User, 
  FileText, 
  Image as ImageIcon,
  ArrowLeft,
  RefreshCw,
  Loader2
} from 'lucide-react';
import Link from 'next/link';

interface StockRequest {
  id: string;
  type: 'MASUK' | 'KELUAR';
  quantity: number;
  notes: string;
  proof_image_url: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  spare_parts: {
    id: string;
    name: string;
    unit: string;
    stock: number;
  } | null;
  users: {
    name: string;
    email: string;
  } | null;
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch semua request yang statusnya PENDING
  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('stock_requests')
      .select(`
        id,
        type,
        quantity,
        notes,
        proof_image_url,
        status,
        created_at,
        spare_parts (id, name, unit, stock),
        users (name, email)
      `)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching requests:', error.message);
    } else {
      setRequests((data as unknown as StockRequest[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Handler untuk APPROVE Request
  const handleApprove = async (req: StockRequest) => {
    if (!req.spare_parts) return;

    const confirmApprove = confirm(
      `Setujui request ${req.type === 'MASUK' ? 'penambahan' : 'pengambilan'} ${req.quantity} ${req.spare_parts.unit} ${req.spare_parts.name}?`
    );
    if (!confirmApprove) return;

    setProcessingId(req.id);

    try {
      // 1. Hitung stok baru
      const currentStock = req.spare_parts.stock;
      const newStock = req.type === 'MASUK' 
        ? currentStock + req.quantity 
        : currentStock - req.quantity;

      if (newStock < 0) {
        throw new Error('Stok tidak mencukupi untuk disetujui!');
      }

      // 2. Update stok di tabel spare_parts
      const { error: updateStockError } = await supabase
        .from('spare_parts')
        .update({ stock: newStock })
        .eq('id', req.spare_parts.id);

      if (updateStockError) throw updateStockError;

      // 3. Update status request menjadi APPROVED
      const { error: updateReqError } = await supabase
        .from('stock_requests')
        .update({ status: 'APPROVED' })
        .eq('id', req.id);

      if (updateReqError) throw updateReqError;

      // 4. Catat riwayat di stock_logs
      await supabase.from('stock_logs').insert({
        spare_part_id: req.spare_parts.id,
        user_id: '2b9820c2-9ed4-46f8-ab4a-b6fa57605df3', // ID Admin / User
        type: req.type,
        quantity: req.quantity,
        notes: `Approval Request: ${req.notes}`
      });

      alert('Request berhasil disetujui & stok telah diperbarui!');
      fetchRequests();
    } catch (err: any) {
      alert(`Gagal menyetujui: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Handler untuk REJECT Request
  const handleReject = async (reqId: string) => {
    const confirmReject = confirm('Tolak request stok ini?');
    if (!confirmReject) return;

    setProcessingId(reqId);

    try {
      const { error } = await supabase
        .from('stock_requests')
        .update({ status: 'REJECTED' })
        .eq('id', reqId);

      if (error) throw error;

      alert('Request berhasil ditolak.');
      fetchRequests();
    } catch (err: any) {
      alert(`Gagal menolak: ${err.message}`);
    } finally {
      setProcessingId(null);
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
            <Clock className="text-amber-500 w-8 h-8" /> Persetujuan Request Stok
          </h1>
          <p className="text-sm text-slate-500">Daftar pengajuan penambahan dan pengambilan barang oleh teknisi</p>
        </div>

        <button 
          onClick={fetchRequests}
          className="flex items-center justify-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition shadow-sm text-sm font-medium self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {/* DAFTAR REQUEST */}
      <main className="max-w-6xl mx-auto">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Memuat pengajuan stok...</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-500 shadow-sm">
            🎉 Tidak ada request stok gantung saat ini. Semua pengajuan sudah diproses!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {requests.map((req) => {
              const isProcessing = processingId === req.id;

              return (
                <div 
                  key={req.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                >
                  {/* INFORMASI BARANG & PEMOHON */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        req.type === 'MASUK' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {req.type === 'MASUK' ? '📦 STOK MASUK' : '📤 STOK KELUAR'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(req.created_at).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Package className="w-5 h-5 text-blue-500 shrink-0" />
                      {req.spare_parts?.name || 'Barang Tidak Ditemukan'}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <User className="w-4 h-4 text-slate-400" />
                        <span>Pemohon: <b>{req.users?.name || 'Teknisi'}</b></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span>Jumlah: <b className="text-blue-600">{req.quantity} {req.spare_parts?.unit}</b> (Sisa Stok: {req.spare_parts?.stock})</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <b>Alasan:</b> "{req.notes}"
                    </p>
                  </div>

                  {/* FOTO BUKTI & ACTION BUTTONS */}
                  <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-center gap-4 w-full md:w-auto justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                    {/* Foto Bukti jika ada */}
                    {req.proof_image_url ? (
                      <a 
                        href={req.proof_image_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="relative group w-20 h-20 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shrink-0 flex items-center justify-center"
                        title="Klik untuk memperbesar foto"
                      >
                        <img 
                          src={req.proof_image_url} 
                          alt="Bukti Request" 
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                      </a>
                    ) : (
                      <div className="w-20 h-20 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-[10px] shrink-0">
                        <ImageIcon className="w-5 h-5 mb-1 text-slate-300" />
                        Tanpa Foto
                      </div>
                    )}

                    {/* Tombol Approval */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={isProcessing}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition text-sm font-semibold disabled:opacity-50"
                      >
                        <X className="w-4 h-4" /> Tolak
                      </button>

                      <button
                        onClick={() => handleApprove(req)}
                        disabled={isProcessing}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition text-sm font-semibold shadow-sm disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Setujui
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}