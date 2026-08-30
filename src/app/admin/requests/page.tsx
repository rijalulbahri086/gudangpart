'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Check, 
  X, 
  Clock, 
  ArrowLeft, 
  RefreshCw, 
  Package, 
  User, 
  FileText,
  Loader2,
  CheckCircle2
} from 'lucide-react';

interface StockRequest {
  id: string;
  spare_part_id: string;
  requester_id: string;
  type: 'MASUK' | 'KELUAR';
  quantity: number;
  notes: string;
  proof_image_url: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  machine_line?: string | null;
  machine_name?: string | null;
  spare_parts: {
    name: string;
    stock: number;
    unit: string;
  } | null;
  requester: {
    full_name: string;
    email: string;
  } | null;
}

export default function AdminRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('stock_requests')
        .select(`
          id,
          spare_part_id,
          requester_id,
          type,
          quantity,
          notes,
          proof_image_url,
          status,
          created_at,
          machine_line,
          machine_name,
          spare_parts (name, stock, unit),
          requester:users!requester_id (full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data as unknown as StockRequest[]) || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      console.error('Error fetching requests:', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (req: StockRequest) => {
    setProcessingId(req.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentStock = req.spare_parts?.stock || 0;
      const newStock = req.type === 'MASUK' 
        ? currentStock + req.quantity 
        : currentStock - req.quantity;

      if (newStock < 0) {
        alert('Gagal: Sisa stok barang tidak mencukupi untuk request ini!');
        setProcessingId(null);
        return;
      }

      // 1. Update stok di spare_parts
      const { error: stockError } = await supabase
        .from('spare_parts')
        .update({ stock: newStock })
        .eq('id', req.spare_part_id);

      if (stockError) throw stockError;

      // 2. Update status request jadi APPROVED
      const { error: reqError } = await supabase
        .from('stock_requests')
        .update({ 
          status: 'APPROVED',
          approved_by: session?.user?.id || req.requester_id
        })
        .eq('id', req.id);

      if (reqError) throw reqError;

      // 3. Catat log ke stock_logs BESERTA machine_line & machine_name agar masuk ke Catatan Pergantian Mesin
      // actor_id menggunakan req.requester_id agar nama teknisi pemohon yang tercatat di histori
      const { error: logError } = await supabase
        .from('stock_logs')
        .insert({
          request_id: req.id,
          spare_part_id: req.spare_part_id,
          actor_id: req.requester_id,
          type: req.type,
          quantity: req.quantity,
          stock_before: currentStock,
          stock_after: newStock,
          machine_line: req.machine_line || null,
          machine_name: req.machine_name || null,
        });

      if (logError) {
        console.error('Gagal mencatat log:', logError.message);
      }

      alert('Request berhasil disetujui & tercatat di Catatan Pergantian Mesin atas nama teknisi!');
      fetchRequests();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      alert(`Terjadi kesalahan: ${msg}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (reqId: string) => {
    const confirmReject = confirm('Apakah Anda yakin ingin menolak pengajuan ini?');
    if (!confirmReject) return;

    setProcessingId(reqId);
    try {
      const { error } = await supabase
        .from('stock_requests')
        .update({ status: 'REJECTED' })
        .eq('id', reqId);

      if (error) throw error;

      alert('Pengajuan berhasil ditolak.');
      fetchRequests();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      alert(`Gagal menolak request: ${msg}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <header className="max-w-5xl mx-auto mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link 
            href="/" 
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-blue-600 transition mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Clock className="text-amber-500 w-8 h-8" /> Approval Request Stok
          </h1>
          <p className="text-sm text-slate-500">Persetujuan pengajuan barang dari teknisi gudang</p>
        </div>

        <button 
          type="button"
          onClick={fetchRequests}
          className="flex items-center justify-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition shadow-sm text-sm font-medium self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      <main className="max-w-5xl mx-auto">
        {loading ? (
          <div className="text-center py-16 text-slate-500 flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span>Memuat pengajuan stok...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-500 shadow-sm p-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700 text-lg mb-1">Semua Pengajuan Selesai</h3>
            <p className="text-sm text-slate-400">Belum ada request pengajuan stok baru saat ini.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => {
              const isPending = req.status === 'PENDING';

              return (
                <div 
                  key={req.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        req.type === 'MASUK' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {req.type === 'MASUK' ? '📦 STOK MASUK' : '📤 STOK KELUAR'}
                      </span>

                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                        req.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {req.status}
                      </span>

                      <span className="text-xs text-slate-400">
                        {new Date(req.created_at).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Package className="w-5 h-5 text-blue-500 shrink-0" />
                      {req.spare_parts?.name || 'Barang Dihapus'}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4 text-slate-400" />
                        <span>Pemohon: <b>{req.requester?.full_name || 'Teknisi'}</b></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span>Jumlah: <b className="text-blue-600">{req.quantity} {req.spare_parts?.unit || 'Pcs'}</b></span>
                      </div>
                    </div>

                    {(req.machine_line || req.machine_name) && (
                      <div className="inline-block bg-amber-50 border border-amber-200/60 text-amber-900 text-xs px-2.5 py-1 rounded-lg font-semibold">
                        ⚙️ Target: {req.machine_line || '-'} ({req.machine_name || '-'})
                      </div>
                    )}

                    <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <b>Catatan Pemohon:</b> &quot;{req.notes || 'Tanpa alasan.'}&quot;
                    </p>
                  </div>

                  <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                    {req.proof_image_url && (
                      <a 
                        href={req.proof_image_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shrink-0"
                        title="Lihat foto bukti"
                      >
                        <img src={req.proof_image_url} alt="Bukti" className="w-full h-full object-cover" />
                      </a>
                    )}

                    {isPending ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleReject(req.id)}
                          disabled={processingId === req.id}
                          className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3.5 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50"
                        >
                          <X className="w-4 h-4" /> Tolak
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprove(req)}
                          disabled={processingId === req.id}
                          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                        >
                          {processingId === req.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          Setujui
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Selesai Diproses</span>
                    )}
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