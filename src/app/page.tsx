'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import RequestModal from '@/app/components/RequestModal';
import Link from 'next/link';
import { 
  Search, 
  Package, 
  MapPin, 
  AlertTriangle, 
  Plus, 
  Minus, 
  RefreshCw,
  Clock,
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
  const [items, setItems] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // State Modal Request
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [requestType, setRequestType] = useState<'MASUK' | 'KELUAR'>('MASUK');
  const [selectedItem, setSelectedItem] = useState<SparePart | null>(null);

  // Fetch data dari Supabase
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
    fetchSpareParts();
  }, []);

  const handleOpenModal = (item: SparePart, type: 'MASUK' | 'KELUAR') => {
    setSelectedItem(item);
    setRequestType(type);
    setModalOpen(true);
  };

  // Filter Pencarian Pintar
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

        <div className="flex items-center gap-2">
          {/* Tombol Navigasi ke Halaman Admin Requests */}
          <Link
            href="/admin/requests"
            className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg transition shadow-sm text-sm font-semibold"
          >
            <Clock className="w-4 h-4" /> Approval Admin
          </Link>

          <button 
            onClick={fetchSpareParts}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition shadow-sm text-sm font-medium"
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
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  {/* AREA FOTO BARANG */}
                  <div className="relative h-48 bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100">
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.name} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="flex flex-col items-center text-slate-400">
                        <ImageIcon className="w-10 h-10 mb-1" />
                        <span className="text-xs">Foto Tidak Tersedia</span>
                      </div>
                    )}

                    <span className="absolute top-2 right-2 bg-slate-900/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {item.condition}
                    </span>
                  </div>

                  {/* DETAIL INFORMASI BARANG */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-slate-800 text-base leading-tight">{item.name}</h3>
                      </div>
                      
                      {item.part_number && (
                        <p className="text-xs font-mono text-slate-500 mb-2">PN: {item.part_number}</p>
                      )}

                      <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-3 bg-slate-50 p-2 rounded-lg">
                        <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>{item.area_location || 'Area -'} • <b>{item.rack_location || 'Rak -'}</b></span>
                      </div>
                    </div>

                    {/* INDICATOR STOK & ACTION */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
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
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL FORM REQUEST */}
      <RequestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        type={requestType}
        item={selectedItem}
        onSuccess={fetchSpareParts}
      />
    </div>
  );
}