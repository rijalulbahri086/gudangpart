'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Package, 
  Search, 
  Plus, 
  FileSpreadsheet, 
  UserPlus, 
  LogOut, 
  Inbox, 
  Settings2, 
  History, 
  MessageSquare, 
  Menu, 
  X, 
  Loader2, 
  AlertTriangle, 
  Cpu, 
  MapPin, 
  LayoutGrid, 
  List,
  RefreshCw,
  PackagePlus,
  LogIn,
  Trash2
} from 'lucide-react';

// Import Komponen Modal & Drawer
import PartDetailModal from '@/app/components/PartDetailModal';
import RequestModal from '@/app/components/RequestModal';
import EditPartModal from '@/app/components/EditPartModal';
import ImportExcelModal from '@/app/components/ImportExcelModal';
import AddUserModal from '@/app/components/AddUserModal';
import AddPartModal from '@/app/components/AddPartModal';
import ChatDrawer from '@/app/components/ChatDrawer';

const MASTER_MACHINE_LIST = [
  'ALL',
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

interface UserSession {
  id: string;
  email?: string;
  name?: string;
  role?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  
  // Data State
  const [items, setItems] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);

  // Tampilan State: 'GRID' (Kartu) vs 'LIST' (Tabel Ringkas)
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMachine, setSelectedMachine] = useState<string>('ALL');
  const [selectedCondition, setSelectedCondition] = useState<string>('ALL');

  // Modal & Drawer UI States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState<boolean>(false);
  const [isAddPartModalOpen, setIsAddPartModalOpen] = useState<boolean>(false);

  // Detail & Action Modal States
  const [selectedDetailItem, setSelectedDetailItem] = useState<SparePart | null>(null);
  const [selectedEditItem, setSelectedEditItem] = useState<SparePart | null>(null);
  const [requestItem, setRequestItem] = useState<{ item: SparePart; type: 'MASUK' | 'KELUAR' } | null>(null);

  // 1. Ambil Sesi Pengguna
  const checkSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase
        .from('users')
        .select('full_name, username, role')
        .eq('id', session.user.id)
        .maybeSingle();

      setCurrentUser({
        id: session.user.id,
        email: session.user.email,
        name: profile?.full_name || profile?.username || session.user.email,
        role: profile?.role || 'TEKNISI',
      });
    } else {
      setCurrentUser(null);
    }
  }, []);

  // 2. Ambil Data Katalog Spare Part
  const fetchSpareParts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('spare_parts')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setItems((data as SparePart[]) || []);
    } catch (err: unknown) {
      console.error('Error fetching spare parts:', err instanceof Error ? err.message : err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
    fetchSpareParts();
  }, [checkSession, fetchSpareParts]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    router.push('/login');
  };

  // 3. Fungsi Hapus Barang (Khusus Admin)
  const handleDeletePart = async (id: string, imageUrl: string | null, name: string) => {
    if (currentUser?.role !== 'ADMIN') {
      alert('Akses ditolak! Hanya Admin yang dapat menghapus barang.');
      return;
    }

    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus "${name}" dari master data? Tindakan ini tidak dapat dibatalkan.`);
    if (!confirmDelete) return;

    try {
      if (imageUrl) {
        try {
          const urlObj = new URL(imageUrl);
          const pathParts = urlObj.pathname.split('/sparepart-images/');
          if (pathParts.length > 1) {
            const filePath = pathParts[1];
            await supabase.storage.from('sparepart-images').remove([filePath]);
          }
        } catch (imgErr) {
          console.warn('Gagal menghapus file gambar fisik, melanjutkan penghapusan data database:', imgErr);
        }
      }

      const { error } = await supabase
        .from('spare_parts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('Barang berhasil dihapus dari sistem.');
      fetchSpareParts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      alert(`Gagal menghapus barang: ${msg}`);
    }
  };

  // Filter Data
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.part_number?.toLowerCase().includes(q) ||
      item.sku?.toLowerCase().includes(q) ||
      item.rack_location?.toLowerCase().includes(q) ||
      item.aliases?.some((alias) => alias.toLowerCase().includes(q)) ||
      false;

    const matchMachine = selectedMachine === 'ALL' || item.machine_target === selectedMachine;
    const matchCondition = selectedCondition === 'ALL' || item.condition === selectedCondition;

    return matchSearch && matchMachine && matchCondition;
  });

  const isAdmin = currentUser?.role === 'ADMIN';
  const isLoggedIn = !!currentUser;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* HEADER & NAVBAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* BRAND LOGO */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-slate-800 text-lg leading-none">GudangPart</h1>
                <p className="text-[10px] text-slate-400 mt-0.5">Manajemen Stok Spare Part</p>
              </div>
            </div>

            {/* NAVIGASI DESKTOP */}
            <div className="hidden md:flex items-center gap-2">
              {isLoggedIn && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsChatOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    <MessageSquare className="w-4 h-4 text-blue-600" /> Diskusi Tim
                  </button>

                  <Link
                    href="/my-requests"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    <Inbox className="w-4 h-4 text-blue-600" /> Request Saya
                  </Link>
                </>
              )}

              <Link
                href="/machine-history"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                <Settings2 className="w-4 h-4 text-amber-500" /> Pergantian Mesin
              </Link>

              <Link
                href="/stock-logs"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                <History className="w-4 h-4 text-indigo-600" /> Audit Log
              </Link>

              {isAdmin && (
                <>
                  <Link
                    href="/admin/requests"
                    className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-xl text-xs font-semibold transition shadow-sm"
                  >
                    <Inbox className="w-4 h-4" /> Kelola Request
                  </Link>

                  <button
                    type="button"
                    onClick={() => setIsAddPartModalOpen(true)}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-semibold transition shadow-sm"
                  >
                    <PackagePlus className="w-4 h-4" /> Tambah Barang
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-semibold transition shadow-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Import Excel
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddUserModalOpen(true)}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-semibold transition shadow-sm"
                  >
                    <UserPlus className="w-4 h-4" /> Tambah User
                  </button>
                </>
              )}

              {currentUser ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition ml-2"
                  title="Keluar"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition ml-2 shadow-sm"
                >
                  <LogIn className="w-4 h-4" /> Login
                </Link>
              )}
            </div>

            {/* HAMBURGER MOBILE */}
            <div className="flex md:hidden items-center gap-2">
              {isLoggedIn && (
                <button
                  type="button"
                  onClick={() => setIsChatOpen(true)}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* DROPDOWN HAMBURGER MENU MOBILE */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 pt-2 pb-4 space-y-1 shadow-xl">
            {isAdmin && (
              <>
                <Link
                  href="/admin/requests"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition mb-1"
                >
                  <Inbox className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Kelola & Approve Request</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsAddPartModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition mb-1"
                >
                  <PackagePlus className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Tambah Master Barang Baru</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsImportModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition mb-1"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Import & Sinkronkan Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsAddUserModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition mb-2"
                >
                  <UserPlus className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Tambah Pengguna Baru</span>
                </button>
              </>
            )}

            {isLoggedIn && (
              <Link
                href="/my-requests"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                <Inbox className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Riwayat Request Saya</span>
              </Link>
            )}

            <Link
              href="/machine-history"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              <Settings2 className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Catatan Pergantian Mesin</span>
            </Link>

            <Link
              href="/stock-logs"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              <History className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Audit Log Stok</span>
            </Link>

            {currentUser ? (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition border-t border-slate-100 mt-2 pt-3"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Keluar dari Akun</span>
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition mt-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Login Aplikasi</span>
              </Link>
            )}
          </div>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-4">
        {/* BARIS PENCARIAN & FILTER */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama barang, PN, SKU, lokasi rak..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            <div>
              <select
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition truncate"
              >
                {MASTER_MACHINE_LIST.map((m) => (
                  <option key={m} value={m}>
                    {m === 'ALL' ? 'Semua Mesin Target' : m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="ALL">Semua Kondisi</option>
                <option value="BARU">Kondisi: BARU</option>
                <option value="BEKAS">Kondisi: BEKAS</option>
              </select>
            </div>
          </div>
        </div>

        {/* CONTROL BAR: TOTAL ITEM & TOGGLE MODE */}
        <div className="flex items-center justify-between gap-2 px-1 py-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Katalog Barang</span>
            <span className="bg-slate-200 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
              {filteredItems.length} Item
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSpareParts}
              className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <div className="bg-slate-200/70 p-1 rounded-xl flex items-center border border-slate-200 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode('GRID')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'GRID'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kartu</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('LIST')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'LIST'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabel</span>
              </button>
            </div>
          </div>
        </div>

        {/* KATALOG DISPLAY */}
        {loading ? (
          <div className="text-center py-20 text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-xs">Memuat katalog spare part...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700 text-base">Tidak Ada Barang Ditemukan</h3>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery || selectedMachine !== 'ALL'
                ? 'Tidak ada spare part yang cocok dengan pencarian Anda.'
                : 'Belum ada barang tersimpan di katalog.'}
            </p>
          </div>
        ) : viewMode === 'GRID' ? (
          /* TAMPILAN 1: GRID KARTU (SELURUH KARTU BISA DI-KLIK) */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => {
              const isLow = Number(item.stock) <= Number(item.min_stock);

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedDetailItem(item)}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden group cursor-pointer"
                >
                  <div>
                    <div className="relative h-44 w-full bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <Package className="w-12 h-12 text-slate-300" />
                      )}

                      <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
                        <span className="bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm">
                          {item.condition}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm ${
                            item.grade === 'ORIGINAL' ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'
                          }`}
                        >
                          {item.grade}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 space-y-2">
                      <h3 className="font-bold text-slate-800 text-sm line-clamp-2 leading-snug">
                        {item.name}
                      </h3>

                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400 font-mono">
                        {item.part_number && <span>PN: <b className="text-slate-600">{item.part_number}</b></span>}
                        {item.sku && <span>SKU: <b className="text-slate-600">{item.sku}</b></span>}
                      </div>

                      <div className="space-y-1 text-xs text-slate-500 pt-1">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">Rak: <b className="text-slate-700">{item.rack_location || '-'}</b></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          <span className="truncate">{item.machine_target || 'Umum'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bagian aksi dicegah agar tidak memicu klik kartu utama */}
                  <div className="p-4 pt-0 space-y-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Sisa Stok</span>
                        <span className={`text-base font-bold ${isLow ? 'text-red-600' : 'text-slate-800'}`}>
                          {item.stock} <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                        </span>
                      </div>

                      {isLow && (
                        <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                          <AlertTriangle className="w-3 h-3" /> Menipis
                        </span>
                      )}
                    </div>

                    {isLoggedIn && (
                      <button
                        type="button"
                        onClick={() => setRequestItem({ item, type: 'KELUAR' })}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-sm flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Ambil
                      </button>
                    )}

                    {isAdmin && (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedEditItem(item)}
                          className="flex-1 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-[11px] font-semibold transition"
                        >
                          Edit Master
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePart(item.id, item.image_url, item.name)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[11px] font-semibold transition flex items-center justify-center"
                          title="Hapus Barang"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TAMPILAN 2: LIST TABEL RINGKAS */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Nama Spare Part</th>
                    <th className="py-3 px-4">Part Number / SKU</th>
                    <th className="py-3 px-4">Rak & Mesin</th>
                    <th className="py-3 px-4">Stok</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredItems.map((item) => {
                    const isLow = Number(item.stock) <= Number(item.min_stock);

                    return (
                      <tr 
                        key={item.id} 
                        onClick={() => setSelectedDetailItem(item)}
                        className="hover:bg-slate-50/80 transition cursor-pointer"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-slate-800 block text-xs">{item.name}</span>
                              <div className="flex gap-1 mt-0.5">
                                <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded">
                                  {item.condition}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          <div>PN: {item.part_number || '-'}</div>
                          {item.sku && <div className="text-[10px] text-slate-400">SKU: {item.sku}</div>}
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          <div className="font-semibold text-slate-800">Rak: {item.rack_location || '-'}</div>
                          <div className="text-[10px] text-slate-400">{item.machine_target || 'Umum'}</div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`font-bold ${isLow ? 'text-red-600' : 'text-slate-800'}`}>
                            {item.stock} {item.unit}
                          </span>
                          {isLow && (
                            <span className="ml-1 text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md font-bold inline-block">
                              Menipis
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {isLoggedIn && (
                              <button
                                type="button"
                                onClick={() => setRequestItem({ item, type: 'KELUAR' })}
                                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" /> Ambil
                              </button>
                            )}

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeletePart(item.id, item.image_url, item.name)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold transition"
                                title="Hapus Barang"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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

      {/* MODAL INTEGRASI */}
      <PartDetailModal
        isOpen={!!selectedDetailItem}
        item={selectedDetailItem}
        onClose={() => setSelectedDetailItem(null)}
        canRequest={isLoggedIn}
        onOpenRequest={(item, type) => setRequestItem({ item, type })}
      />

      {isLoggedIn && (
        <RequestModal
          isOpen={!!requestItem}
          item={requestItem?.item || null}
          type={requestItem?.type || 'KELUAR'}
          onClose={() => setRequestItem(null)}
          onSuccess={fetchSpareParts}
        />
      )}

      {isAdmin && (
        <>
          <AddPartModal
            isOpen={isAddPartModalOpen}
            onClose={() => setIsAddPartModalOpen(false)}
            onSuccess={fetchSpareParts}
          />

          <EditPartModal
            isOpen={!!selectedEditItem}
            item={selectedEditItem}
            onClose={() => setSelectedEditItem(null)}
            onSuccess={fetchSpareParts}
          />

          <ImportExcelModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onSuccess={fetchSpareParts}
          />

          <AddUserModal
            isOpen={isAddUserModalOpen}
            onClose={() => setIsAddUserModalOpen(false)}
          />
        </>
      )}

      {/* CHAT DRAWER */}
      {isLoggedIn && (
        <ChatDrawer
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}