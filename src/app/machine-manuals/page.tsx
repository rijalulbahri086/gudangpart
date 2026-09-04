'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  BookOpen, 
  Cpu, 
  ExternalLink, 
  FileText, 
  Loader2, 
  Package, 
  Search 
} from 'lucide-react';

const MASTER_MACHINE_LIST = [
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
  name: string;
  part_number: string | null;
  machine_target: string;
  stock: number;
  unit: string;
}

export default function MachineManualsPage() {
  const router = useRouter();
  const [selectedMachine, setSelectedMachine] = useState<string>(MASTER_MACHINE_LIST[0]);
  const [parts, setParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Ambil daftar part berdasarkan mesin yang dipilih
  useEffect(() => {
    const fetchPartsByMachine = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('spare_parts')
          .select('id, name, part_number, machine_target, stock, unit')
          .eq('machine_target', selectedMachine)
          .order('name', { ascending: true });

        if (error) throw error;
        setParts(data || []);
      } catch (err) {
        console.error('Error fetching parts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPartsByMachine();
  }, [selectedMachine]);

  // Simulasi link manual book per mesin (Bisa diganti dengan kolom database atau URL Google Drive/PDF Anda)
  // Anda bisa menyesuaikan link ini dengan link dokumen asli perusahaan Anda
  const getMachineManualLink = (machine: string) => {
    // Contoh mapping manual book (bisa disesuaikan atau dikosongkan jika belum ada)
    const links: Record<string, string> = {
      'Blowing': 'https://drive.google.com/drive/folders/1kTUhZO4Co_AHKue_FikTQAWGtOblTrs9?usp=drive_link',
      'Filling': 'https://drive.google.com/drive/folders/1kV2oav8xsmRZUoSGLUIZaFtJUeRgmHwG?usp=drive_link',
      'label': 'https://drive.google.com/drive/folders/1_bvR8G0YZa5dXp4lPG9Qtk-PH2VPCbLB?usp=drive_link',
      'dasessing': 'https://drive.google.com/drive/folders/1du5tRFlCJb1fPBTF9uIWcORFLz7qJ8Ie?usp=drive_link',
    };
    return links[machine] || null;
  };

  const manualLink = getMachineManualLink(selectedMachine);

  const filteredParts = parts.filter(p => 
    !searchQuery || 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.part_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-600"
              title="Kembali ke Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-bold text-slate-800 text-base sm:text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" /> Manual Book Mesin
              </h1>
              <p className="text-[10px] text-slate-400">Panduan teknis dan daftar spare part per unit mesin</p>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* SIDEBAR PILIH MESIN */}
        <div className="lg:col-span-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm h-fit space-y-2">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">Pilih Unit Mesin</h2>
          <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
            {MASTER_MACHINE_LIST.map((machine) => {
              const isSelected = selectedMachine === machine;
              return (
                <button
                  key={machine}
                  onClick={() => {
                    setSelectedMachine(machine);
                    setSearchQuery('');
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-between ${
                    isSelected 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Cpu className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    {machine}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* KONTEN DETAIL MANUAL BOOK & SPARE PART */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* KARTU INFORMASI UTAMA MESIN */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg uppercase">
                Unit Aktif
              </span>
              <h2 className="text-xl font-bold text-slate-800 mt-2">{selectedMachine}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Akses dokumen panduan teknis dan daftar komponen yang terdaftar untuk mesin ini.
              </p>
            </div>

            {manualLink ? (
              <a
                href={manualLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm shrink-0"
              >
                <FileText className="w-4 h-4" /> Buka Dokumen PDF <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <div className="bg-slate-100 text-slate-500 px-4 py-2.5 rounded-xl text-xs font-medium border border-slate-200">
                📄 Dokumen Manual Book belum diunggah
              </div>
            )}
          </div>

          {/* DAFTAR SPARE PART TERKAIT MESIN INI */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" /> Spare Part Terkait ({filteredParts.length} Item)
              </h3>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari part mesin ini..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs">Memuat daftar komponen...</span>
              </div>
            ) : filteredParts.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                Belum ada spare part yang didaftarkan khusus untuk mesin {selectedMachine}.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredParts.map((part) => (
                  <div key={part.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition space-y-1">
                    <h4 className="font-bold text-slate-800 text-xs">{part.name}</h4>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>PN: <b className="font-mono text-slate-700">{part.part_number || '-'}</b></span>
                      <span className="font-semibold text-blue-600">Stok: {part.stock} {part.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}