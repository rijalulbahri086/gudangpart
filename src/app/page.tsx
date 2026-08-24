'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import SplashScreen from '@/app/components/SplashScreen';
import RequestModal from '@/app/components/RequestModal';
import AddUserModal from '@/app/components/AddUserModal';
import ChatDrawer from '@/app/components/ChatDrawer';
import AddPartModal from '@/app/components/AddPartModal';
import EditPartModal from '@/app/components/EditPartModal';
import PartDetailModal from '@/app/components/PartDetailModal';
import ImportExcelModal from '@/app/components/ImportExcelModal';
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
  Image as ImageIcon,
  Settings2,
  MessageSquare,
  UserPlus,
  Menu,
  X,
  FileSpreadsheet
} from 'lucide-react';

// 🟢 DAFTAR MASTER NAMA MESIN KONSISTEN (KATALOG)
const MACHINE_LIST = [
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

export default function Dashboard() {
  const router = useRouter();

  // 🟢 STATE SPLASH SCREEN (Tampil saat awal masuk web)
  const [showSplash, setShowSplash] = useState<boolean>(true);

  const [items, setItems] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showOnlyLowStock, setShowOnlyLowStock] = useState<boolean>(false);
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);

  // STATE FILTER PERUNTUKAN MESIN
  const [selectedMachine, setSelectedMachine] = useState<string>('ALL');

  // STATE MENU HAMBURGER MOBILE
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

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

  // State Chat Drawer
  const [chatOpen, setChatOpen] = useState<boolean>(false);

  // State Tambah User
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

      if (userError) {
        console.error('Error fetching user profile:', userError.message);
      }

      const displayName =
        userData?.full_name ||
        session.user.user_metadata?.full_name ||
        session.user.email;

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
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert('Terjadi kesalahan saat menghapus barang.');
      }
    }
  };

  // LOGIKA FILTERING GANDA
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase().trim();

    const matchName = item.name?.toLowerCase().includes(q) || false;
    const matchPartNo = item.part_number?.toLowerCase().includes(q) || false;
    const matchSku = item.sku?.toLowerCase().includes(q) || false;
    const matchArea = item.area_location?.toLowerCase().includes(q) || false;
    const matchRack = item.rack_location?.toLowerCase().includes(q) || false;
    const matchAlias = item.aliases?.some(alias => alias?.toLowerCase().includes(q)) || false;

    const matchesSearch = !q || matchName || matchPartNo || matchSku || matchArea || matchRack || matchAlias;

    const matchesMachine =
      selectedMachine === 'ALL' || item.machine_target === selectedMachine;

    const currentStock = Number(item.stock ?? 0);
    const minStock = Number(item.min_stock ?? 0);
    const isLowStock = currentStock <= minStock;

    const matchesLowStock = showOnlyLowStock ? isLowStock : true;

    return matchesSearch && matchesMachine && matchesLowStock;
  });

  const isAuthorizedUser = currentUser?.role === 'TEKNISI' || currentUser?.role === 'ADMIN';
  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <>
      {/* 🟢 ANIMASI SPLASH SCREEN SAAT AWAL MASUK WEB (2-3 Detik) */}
      {showSplash && (
        <SplashScreen finishLoading={() => setShowSplash(false)} />
      )}

      <div className="min-h-screen bg-slate-50 p-4 pt-[max(2rem,env(safe-area-inset-top))] md:p-8">
        {/* HEADER UTAMA */}
        <header className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
                <Package className="text-blue-600 w-8 h-8" /> GudangPart
              </h1>
              <p className="text-sm text-slate-500">Sistem Manajemen Stok & Pencarian Spare Part</p>
            </div>

            {/* TOMBOL HAMBURGER MOBILE */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition shadow-sm"
              title="Buka Menu Navigasi"
            >
              <Menu className="w-6 h-6 text-slate-700" />
            </button>
          </div>

          {/* BAR TOMBOL UTAMA */}
          <div className="flex flex-wrap items-center gap-2">
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

            <button
              onClick={fetchSpareParts}
              className="flex items-center justify-center gap-2 bg-white border border-slate-200 px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition shadow-sm text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>

            {/* NAVIGASI DESKTOP */}
            <div className="hidden md:flex items-center gap-2">
              {currentUser && (
                <Link
                  href="/my-requests"
                  className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-3.5 py-2 rounded-lg transition shadow-sm text-sm font-semibold"
                >
                  <Inbox className="w-4 h-4 text-blue-600" /> Request Saya
                </Link>
              )}

              <Link
                href="/stock-logs"
                className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-3.5 py-2 rounded-lg transition shadow-sm text-sm font-semibold"
              >
                <History className="w-4 h-4 text-slate-600" /> Riwayat Stok
              </Link>

              <Link
                href="/machine-history"
                className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-lg transition shadow-sm text-sm font-semibold"
              >
                <Settings2 className="w-4 h-4" /> Catatan Mesin
              </Link>

              {isAdmin && (
                <>
                  <button
                    onClick={() => setImportModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg transition shadow-sm text-sm font-semibold"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Import Excel
                  </button>

                  <button
                    onClick={() => setAddUserModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg transition shadow-sm text-sm font-semibold"
                  >
                    <UserPlus className="w-4 h-4" /> Tambah User
                  </button>

                  <button
                    onClick={() => setAddModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg transition shadow-sm text-sm font-semibold"
                  >
                    <PackagePlus className="w-4 h-4" /> Tambah Barang
                  </button>

                  <Link
                    href="/admin/requests"
                    className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-lg transition shadow-sm text-sm font-semibold"
                  >
                    <Clock className="w-4 h-4" /> Approval Admin
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        {/* KARTU RINGKASAN LOW STOCK ALERT */}
        <div className="max-w-7xl mx-auto mb-6">
          {(() => {
            const lowStockCount = items.filter(item => Number(item.stock) <= Number(item.min_stock)).length;

            if (lowStockCount === 0) {
              return (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between text-emerald-800 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500 text-white p-2 rounded-lg">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-sm">Status Stok Aman</h2>
                      <p className="text-xs text-emerald-600">Semua spare part berada di atas batas minimum stok.</p>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-red-800 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-red-500 text-white p-2 rounded-lg animate-pulse">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm">Peringatan: Stok Menipis!</h2>
                    <p className="text-xs text-red-600">
                      Ada <b>{lowStockCount} spare part</b> yang stoknya sudah mencapai atau di bawah batas minimum.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedMachine('ALL');
                    setShowOnlyLowStock(true);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-sm shrink-0"
                >
                  Lihat {lowStockCount} Item Menipis
                </button>
              </div>
            );
          })()}
        </div>

        {/* SEARCH BAR & FILTER */}
        <div className="max-w-7xl mx-auto mb-8 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari spare part berdasarkan nama, alias, part number, rak..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3">
            <div className="w-full sm:w-64">
              <select
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                className="w-full py-3 px-4 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
              >
                <option value="ALL">🔍 Semua Mesin</option>
                {MACHINE_LIST.map((machine) => (
                  <option key={machine} value={machine}>
                    {machine}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowOnlyLowStock(!showOnlyLowStock)}
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition flex items-center justify-center gap-2 shrink-0 ${showOnlyLowStock
                ? 'bg-red-600 border-red-600 text-white shadow-md shadow-red-500/20'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
            >
              <AlertTriangle className={`w-4 h-4 ${showOnlyLowStock ? 'text-white' : 'text-red-500'}`} />
              <span>{showOnlyLowStock ? 'Tampilkan Semua' : 'Stok Menipis Saja'}</span>
            </button>
          </div>
        </div>

        {/* GRID KATALOG SPARE PART */}
        <main className="max-w-7xl mx-auto">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Memuat data spare part...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-500">
              {searchQuery || selectedMachine !== 'ALL' || showOnlyLowStock
                ? 'Barang tidak ditemukan untuk kriteria filter ini.'
                : 'Belum ada data barang di database.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map((item) => {
                const isLowStock = Number(item.stock) <= Number(item.min_stock);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleOpenDetailModal(item)}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 transition flex flex-col justify-between cursor-pointer group"
                  >
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

                      <div className="absolute top-2 right-2 flex gap-1 flex-wrap justify-end">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm shadow-sm ${item.grade === 'ORIGINAL'
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

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-bold text-slate-800 text-base leading-tight group-hover:text-blue-600 transition">
                            {item.name}
                          </h3>

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

                        <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{item.area_location || 'Area -'} • <b>Rak: {item.rack_location || '-'}</b></span>
                        </div>
                      </div>

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
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        </div>

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
                          <Link
                            href="/login"
                            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition border border-slate-200 font-medium"
                          >
                            <Lock className="w-3.5 h-3.5" /> Login Req
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* TOMBOL CHAT MELAYANG */}
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white p-3.5 rounded-full shadow-lg shadow-blue-500/30 transition flex items-center justify-center group"
          title="Buka Chat Tim"
        >
          <MessageSquare className="w-6 h-6 group-hover:scale-110 transition" />
        </button>

        {/* DRAWER CHAT */}
        <ChatDrawer
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          currentUser={currentUser}
        />

        {/* DRAWER MENU MOBILE */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm md:hidden">
            <div className="w-4/5 max-w-sm bg-white h-full p-6 flex flex-col justify-between shadow-2xl">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                  <div className="flex items-center gap-2">
                    <Package className="w-6 h-6 text-blue-600" />
                    <span className="font-bold text-lg text-slate-800">Menu Navigasi</span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {currentUser && (
                    <Link
                      href="/my-requests"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-sm transition"
                    >
                      <Inbox className="w-5 h-5 text-blue-600" />
                      <span>Request Saya</span>
                    </Link>
                  )}

                  <Link
                    href="/stock-logs"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-sm transition"
                  >
                    <History className="w-5 h-5 text-slate-600" />
                    <span>Riwayat Stok</span>
                  </Link>

                  <Link
                    href="/machine-history"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 w-full p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-semibold text-sm transition"
                  >
                    <Settings2 className="w-5 h-5 text-amber-600" />
                    <span>Catatan Mesin</span>
                  </Link>

                  {isAdmin && (
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                        Menu Administrator
                      </p>

                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setAddUserModalOpen(true);
                        }}
                        className="flex items-center gap-3 w-full p-3 rounded-xl bg-emerald-50 text-emerald-800 font-semibold text-sm transition"
                      >
                        <UserPlus className="w-5 h-5 text-emerald-600" />
                        <span>Tambah User Baru</span>
                      </button>

                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setAddModalOpen(true);
                        }}
                        className="flex items-center gap-3 w-full p-3 rounded-xl bg-blue-50 text-blue-800 font-semibold text-sm transition"
                      >
                        <PackagePlus className="w-5 h-5 text-blue-600" />
                        <span>Tambah Barang Baru</span>
                      </button>

                      <Link
                        href="/admin/requests"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 w-full p-3 rounded-xl bg-amber-50 text-amber-800 font-semibold text-sm transition"
                      >
                        <Clock className="w-5 h-5 text-amber-600" />
                        <span>Approval Admin</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {currentUser && (
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Login sebagai: <b>{currentUser.name}</b></span>
                  <span className="font-bold text-blue-600">{currentUser.role}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ALL MODALS */}
        <RequestModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          type={requestType}
          item={selectedItem}
          onSuccess={fetchSpareParts}
        />

        <AddPartModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          onSuccess={fetchSpareParts}
        />

        <EditPartModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          item={editingItem}
          onSuccess={fetchSpareParts}
        />

        <AddUserModal
          isOpen={addUserModalOpen}
          onClose={() => setAddUserModalOpen(false)}
        />

        <ImportExcelModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onSuccess={fetchSpareParts}
        />

        <PartDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          item={detailItem}
          onOpenRequest={handleOpenModal}
          canRequest={isAuthorizedUser}
        />
      </div>
    </>
  );
}