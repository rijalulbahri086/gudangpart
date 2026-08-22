'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import RequestModal from '@/app/components/RequestModal';
import AddUserModal from '@/app/components/AddUserModal';
import ChatDrawer from '@/app/components/ChatDrawer';
import { MessageSquare } from 'lucide-react';
import { UserPlus } from 'lucide-react';
import AddPartModal from '@/app/components/AddPartModal';
import EditPartModal from '@/app/components/EditPartModal';
import PartDetailModal from '@/app/components/PartDetailModal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Package, 
  MapPin, 
  AlertTriangle, 
  Plus, 
  Minus, 
  RefreshCw,
  Clock,
  LogOut,
  LogIn,
  User,
  Lock,
  PackagePlus,
  Pencil,
  Trash2,
  Inbox,
  History,
  Image as ImageIcon 
} from 'lucide-react';

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

export default function Dashboard() {
  const router = useRouter();
  const [items, setItems] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // State User & Auth
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string; name?: string; role?: string } | null>(null);

  // State Modal Request (+ / -)
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [requestType, setRequestType] = useState<'MASUK' | 'KELUAR'>('MASUK');
  const [selectedItem, setSelectedItem] = useState<SparePart | null>(null);

  // State Modal Tambah Barang Baru
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);

  // State Modal Edit Barang
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<SparePart | null>(null);

  // state chat drawer
  const [chatOpen, setChatOpen] = useState<boolean>(false);

  //state tambah user
  const [addUserModalOpen, setAddUserModalOpen] = useState<boolean>(false);

  // State Modal Detail Barang
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [detailItem, setDetailItem] = useState<SparePart | null>(null);

  // Cek Session User
  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('full_name, role')
        .eq('id', session.user.id)
        .maybeSingle();

          // 🟢 KODE BARU (Perbaikan penanganan JWT Future & Fallback User):
    if (userError) {
      console.error('Error fetching user profile:', userError.message);
      
      // Jika terjadi error JWT issued at future, beritahu dev di console
      if (userError.message.includes('JWT issued at future')) {
        console.warn('⚠️ Jam komputer kamu tidak sinkron dengan server Supabase. Silakan sync jam laptop kamu!');
      }
    }

    // Mengambil display name: Utamakan full_name, jika null/error pakai metadata auth, jika tidak ada baru email
    const displayName = 
      userData?.full_name || 
      session.user.user_metadata?.full_name || 
      session.user.email;

    // Mengambil role: Utamakan dari tabel database, jika error fallback ke metadata auth
    const userRole = 
      userData?.role || 
      session.user.user_metadata?.role || 
      'TEKNISI';

      setCurrentUser({
        id: session.user.id,
        email: session.user.email,
        name: displayName,
        role: userRole
      });
    } else {
      setCurrentUser(null);
    }
  };

  const fetchSpareParts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('spare_parts')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching data:', error.message);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkSession();
    fetchSpareParts();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    router.refresh();
  };

  const handleOpenModal = (item: SparePart, type: 'MASUK' | 'KELUAR') => {
    setSelectedItem(item);
    setRequestType(type);
    setModalOpen(true);
  };

  const handleOpenEditModal = (item: SparePart) => {
    setEditingItem(item);
    setEditModalOpen(true);
  };

  const handleOpenDetailModal = (item: SparePart) => {
    setDetailItem(item);
    setDetailModalOpen(true);
  };

  const handleDeleteItem = async (item: SparePart) => {
    const confirmDelete = confirm(`Apakah Anda yakin ingin menghapus barang "${item.name}" dari database?`);
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('spare_parts')
        .delete()
        .eq('id', item.id);

      if (error) {
        throw new Error(`Gagal menghapus barang: ${error.message}`);
      }

      alert('Barang berhasil dihapus!');
      fetchSpareParts();
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat menghapus barang.');
    }
  };

  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchName = item.name.toLowerCase().includes(q);
    const matchPartNo = item.part_number?.toLowerCase().includes(q) || false;
    const matchSku = item.sku?.toLowerCase().includes(q) || false;
    const matchArea = item.area_location?.toLowerCase().includes(q) || false;
    const matchRack = item.rack_location?.toLowerCase().includes(q) || false;
    const matchAlias = item.aliases?.some(alias => alias.toLowerCase().includes(q)) || false;

    return matchName || matchPartNo || matchSku || matchArea || matchRack || matchAlias;
  });

  const isAuthorizedUser = currentUser?.role === 'TEKNISI' || currentUser?.role === 'ADMIN';
  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      {/* HEADER UTAMA */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="text-blue-600 w-8 h-8" /> GudangPart
          </h1>
          <p className="text-sm text-slate-500">Sistem Manajemen Stok & Pencarian Spare Part</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* USER INFO / TOMBOL LOGIN */}
          {currentUser ? (
            <div className="flex items-center gap-2 bg-white p-1.5 pl-3 rounded-xl border border-slate-200 shadow-sm text-xs text-slate-700">
              <User className="w-4 h-4 text-blue-500" />
              <span><b>{currentUser.name}</b> ({currentUser.role})</span>
              <button 
                onClick={handleLogout} 
                className="p-1.5 hover:bg-slate-100 rounded-lg text-red-500 transition ml-1"
                title="Keluar / Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition shadow-sm text-sm font-semibold"
            >
              <LogIn className="w-4 h-4" /> Login
            </Link>
          )}

          {/* TOMBOL REQUEST SAYA */}
          {currentUser && (
            <Link
              href="/my-requests"
              className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-3.5 py-2 rounded-lg transition shadow-sm text-sm font-semibold"
            >
              <Inbox className="w-4 h-4 text-blue-600" /> Request Saya
            </Link>
          )}

          {/* TOMBOL RIWAYAT STOK */}
          <Link
            href="/stock-logs"
            className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-3.5 py-2 rounded-lg transition shadow-sm text-sm font-semibold"
          >
            <History className="w-4 h-4 text-slate-600" /> Riwayat Stok
          </Link>

          {/* TOMBOL KHUSUS ADMIN */}
          {isAdmin && (
            <>
              {/* 1. TOMBOL TAMBAH TEKNISI / USER (WARNA HIJAU) */}
              <button
                onClick={() => setAddUserModalOpen(true)}
                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg transition shadow-sm text-sm font-semibold"
              >
                <UserPlus className="w-4 h-4" /> Tambah User
              </button>

              {/* 2. TOMBOL TAMBAH MASTER BARANG (WARNA BIRU) */}
              <button
                onClick={() => setAddModalOpen(true)}
                className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg transition shadow-sm text-sm font-semibold"
              >
                <PackagePlus className="w-4 h-4" /> Tambah Barang
              </button>

              {/* 3. TOMBOL APPROVAL REQUEST (WARNA AMBER) */}
              <Link
                href="/admin/requests"
                className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-lg transition shadow-sm text-sm font-semibold"
              >
                <Clock className="w-4 h-4" /> Approval Admin
              </Link>
            </>
          )}

          <button 
            onClick={fetchSpareParts}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition shadow-sm text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </header>

      {/* SEARCH BAR PINTAR */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari spare part berdasarkan nama, alias (ex: laher), part number, rak..."
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
      </div>

      {/* GRID KATALOG SPARE PART */}
      <main className="max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Memuat data spare part...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-500">
            {searchQuery ? 'Barang tidak ditemukan.' : 'Belum ada data barang di database.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item) => {
              const isLowStock = item.stock <= item.min_stock;

              return (
                <div 
                  key={item.id} 
                  onClick={() => handleOpenDetailModal(item)}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 transition flex flex-col justify-between cursor-pointer group"
                >
                  {/* GAMBAR BARANG & BADGES */}
                  <div className="relative h-48 bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100">
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300" 
                      />
                    ) : (
                      <div className="flex flex-col items-center text-slate-400">
                        <ImageIcon className="w-10 h-10 mb-1" />
                        <span className="text-xs">Foto Tidak Tersedia</span>
                      </div>
                    )}

                    {/* BADGES GRADE (ORIGINAL / PABRIKASI) & KONDISI */}
                    <div className="absolute top-2 right-2 flex gap-1 flex-wrap justify-end">
                      <span 
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm shadow-sm ${
                          item.grade === 'ORIGINAL' 
                            ? 'bg-emerald-600/90 text-white' 
                            : 'bg-indigo-600/90 text-white'
                        }`}
                      >
                        {item.grade || 'ORIGINAL'}
                      </span>
                      <span className="bg-slate-900/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-sm">
                        {item.condition}
                      </span>
                    </div>
                  </div>

                  {/* KONTEN KARTU */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-slate-800 text-base leading-tight group-hover:text-blue-600 transition">
                          {item.name}
                        </h3>

                        {/* TOMBOL EDIT & HAPUS KHUSUS ADMIN */}
                        {isAdmin && (
                          <div 
                            onClick={(e) => e.stopPropagation()} 
                            className="flex items-center gap-1 shrink-0 bg-slate-100 p-1 rounded-lg border border-slate-200"
                          >
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1 hover:bg-white rounded text-blue-600 transition"
                              title="Edit Barang"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="p-1 hover:bg-white rounded text-red-600 transition"
                              title="Hapus Barang"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {item.part_number && (
                        <p className="text-xs font-mono text-slate-500 mb-2">PN: {item.part_number}</p>
                      )}

                      {/* LOKASI RAK & AREA */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>{item.area_location || 'Area -'} • <b>Rak: {item.rack_location || '-'}</b></span>
                      </div>
                    </div>

                    {/* SISA STOK & TOMBOL AKSI */}
                    <div 
                      onClick={(e) => e.stopPropagation()} 
                      className="pt-3 border-t border-slate-100 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs text-slate-400 block">Sisa Stok</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-lg font-bold ${isLowStock ? 'text-red-600' : 'text-slate-800'}`}>
                            {item.stock} {item.unit}
                          </span>
                          {isLowStock && (
                            <AlertTriangle className="w-4 h-4 text-red-500" aria-label="Stok Menipis!" />
                          )}
                        </div>
                      </div>

                      {/* KHUSUS TEKNISI / ADMIN */}
                      {isAuthorizedUser ? (
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleOpenModal(item, 'MASUK')}
                            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition"
                            title="Request Tambah Stok"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleOpenModal(item, 'KELUAR')}
                            className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition"
                            title="Request Ambil Stok"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        /* UNTUK PENGUNJUNG UMUM */
                        <Link 
                          href="/login"
                          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition border border-slate-200 font-medium"
                          title="Login sebagai Teknisi / Admin untuk request stok"
                        >
                          <Lock className="w-3.5 h-3.5" /> Login Req
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          {/* 🟢 TOMBOL CHAT MELAYANG (DI POJOK KANAN BAWAH) */}
          <button
            onClick={() => setChatOpen(true)}
            className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white p-3.5 rounded-full shadow-lg shadow-blue-500/30 transition flex items-center justify-center group"
            title="Buka Chat Tim"
          >
            <MessageSquare className="w-6 h-6 group-hover:scale-110 transition" />
          </button>

          {/* 🟢 DRAWER CHAT INTERACTIVE */}
          <ChatDrawer
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
            currentUser={currentUser}
          />

          </div>
        )}
      </main>

      {/* MODAL REQUEST STOK */}
      <RequestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        type={requestType}
        item={selectedItem}
        onSuccess={fetchSpareParts}
      />

      {/* MODAL TAMBAH BARANG BARU (KHUSUS ADMIN) */}
      <AddPartModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={fetchSpareParts}
      />

      {/* MODAL EDIT BARANG (KHUSUS ADMIN) */}
      <EditPartModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        item={editingItem}
        onSuccess={fetchSpareParts}
      />

      {/* 🟢 MODAL TAMBAH USER BARU (KHUSUS ADMIN) */}
      <AddUserModal
        isOpen={addUserModalOpen}
        onClose={() => setAddUserModalOpen(false)}
      />

      {/* MODAL DETAIL BARANG */}
      <PartDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        item={detailItem}
        onOpenRequest={handleOpenModal}
        canRequest={isAuthorizedUser}
      />
    </div>
  );
}