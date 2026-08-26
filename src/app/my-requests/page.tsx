'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Package, 
  RefreshCw, 
  FileText, 
  Image as ImageIcon,
  Loader2,
  Inbox,
  Settings2
} from 'lucide-react';

interface StockRequest {
  id: string;
  type: 'MASUK' | 'KELUAR';
  quantity: number;
  notes: string;
  proof_image_url: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  machine_line: string | null;
  machine_name: string | null;
  spare_parts: {
    id: string;
    name: string;
    unit: string;
    part_number: string | null;
  } | null;
}

export default function MyRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<{ full_name: string; role: string } | null>(null);

  const fetchMyRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      // Ambil profil user
      const { data: userData } = await supabase
        .from('users')
        .select('full_name, role')
        .eq('id', session.user.id)
        .maybeSingle();

      setUserProfile(userData || { full_name: session.user.email || 'Teknisi', role: 'TEKNISI' });

      // Ambil riwayat pengajuan milik user
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
          machine_line,
          machine_name,
          spare_parts (id, name, unit, part_number)
        `)
        .eq('requester_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRequests((data as unknown as StockRequest[]) || []);
    } catch (err: unknown) {
      console.error('Error fetching my requests:', err instanceof Error ? err.message : err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchMyRequests();

    // Listener Realtime saat status pengajuan di-update oleh Admin
    const channel = supabase
      .channel('my_requests_updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stock_requests' },
        () => {
          fetchMyRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMyRequests]);

  const getStatusBadge = (status: 'PENDING' | 'APPROVED' | 'REJECTED') => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Disetujui
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> Ditolak
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 animate-pulse" /> Menunggu Approval
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      {/* HEADER PAGE */}
      <header className="max-w-4xl mx-auto mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link 
            href="/" 
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-blue-600 transition mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Inbox className="text-blue-600 w-8 h-8" /> Riwayat Request Saya
          </h1>
          <p className="text-sm text-slate-500">
            Daftar pengajuan penambahan dan pengambilan barang oleh {userProfile?.full_name || 'Teknisi'}
          </p>
        </div>

        <button 
          type="button"
          onClick={fetchMyRequests}
          className="flex items-center justify-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition shadow-sm text-sm font-medium self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-4xl mx-auto">
        {loading && requests.length === 0 ? (
          <div className="text-center py-16 text-slate-500 flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span>Memuat data pengajuan Anda...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-500 shadow-sm p-6">
            <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700 text-lg mb-1">Belum Ada Pengajuan</h3>
            <p className="text-sm text-slate-400 mb-4">
              Anda belum pernah membuat request penambahan atau pengambilan stok barang.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              Ajukan Request di Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <div 
                key={req.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
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
                    {getStatusBadge(req.status)}
                    <span className="text-xs text-slate-400 ml-auto sm:ml-0">
                      {new Date(req.created_at).toLocaleString('id-ID', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-500 shrink-0" />
                    {req.spare_parts?.name || 'Barang Tidak Ditemukan'}
                  </h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Jumlah: <b className="text-blue-600">{req.quantity} {req.spare_parts?.unit || 'Pcs'}</b></span>
                    </div>

                    {(req.machine_line || req.machine_name) && (
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Settings2 className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Unit: <b>{req.machine_line || 'Line -'}</b> ({req.machine_name || 'Umum'})</span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <b>Alasan:</b> "{req.notes}"
                  </p>
                </div>

                {/* FOTO BUKTI / FISIK */}
                {req.proof_image_url ? (
                  <a 
                    href={req.proof_image_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="relative group w-20 h-20 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shrink-0 flex items-center justify-center self-start sm:self-center"
                    title="Klik untuk melihat foto bukti"
                  >
                    <img 
                      src={req.proof_image_url} 
                      alt="Bukti Request" 
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  </a>
                ) : (
                  <div className="w-20 h-20 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-[10px] shrink-0 self-start sm:self-center">
                    <ImageIcon className="w-5 h-5 mb-1 text-slate-300" />
                    Tanpa Foto
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}