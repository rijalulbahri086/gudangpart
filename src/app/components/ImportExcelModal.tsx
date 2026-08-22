'use client';

import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import * as XLSX from 'xlsx';
import { 
  X, 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  PlusCircle 
} from 'lucide-react';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportExcelModal({ isOpen, onClose, onSuccess }: ImportExcelModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen) return null;

  // KETIKA FILE EXCEL DIPILIH / DIUNGGAH
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage('');
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) return;

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];

        // Convert sheet ke JSON
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        // Map data sesuai aturan pemetaan
        const mappedData = rawJson.map((row) => ({
          sku: row['KODE'] ? String(row['KODE']).trim() : null,
          name: row['NAMA MATERIAL'] ? String(row['NAMA MATERIAL']).trim() : 'Tanpa Nama',
          unit: row['SAT'] ? String(row['SAT']).trim() : 'PCS',
          rack_location: row['LOKASI'] ? String(row['LOKASI']).trim() : '-',
          stock: Number(row['AKTUAL'] ?? 0),
          area_location: 'GDSP',
          condition: 'BARU',
          grade: 'ORIGINAL',
          min_stock: 0,
          machine_target: 'Umum / All Machine'
        }));

        setPreviewData(mappedData);
      } catch (err) {
        console.error('Error parsing Excel:', err);
        setErrorMessage('Gagal membaca file Excel. Pastikan format file .xlsx atau .xls valid.');
      }
    };

    reader.readAsBinaryString(selectedFile);
  };

  // EKSEKUSI UPSERT KE SUPABASE
  const handleImportSubmit = async () => {
    if (previewData.length === 0) {
      setErrorMessage('Tidak ada data yang dapat diimport.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // Upsert: Memperbarui jika SKU cocok, atau menambah jika SKU baru
      const { error } = await supabase
        .from('spare_parts')
        .upsert(previewData, { onConflict: 'sku' });

      if (error) {
        throw new Error(error.message);
      }

      alert(`Berhasil memperbarui & mengsinkronkan ${previewData.length} data spare part ke database!`);

      onSuccess();
      onClose();
      setFile(null);
      setPreviewData([]);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(`Gagal memproses import: ${err.message}`);
      } else {
        setErrorMessage('Terjadi kesalahan tidak terduga saat mengunggah data.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Import & Sinkronkan Data Excel</h3>
              <p className="text-xs text-slate-500">Otomatis memperbarui stok barang lama & menambah item baru</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY MODAL */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* INPUT FILE EXCEL */}
          <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-6 text-center transition bg-slate-50/50 hover:bg-emerald-50/20 relative group">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-emerald-500 mx-auto mb-2 transition" />
            <p className="text-sm font-semibold text-slate-700">
              {file ? file.name : 'Klik atau seret file Buku.xlsx ke sini'}
            </p>
            <p className="text-xs text-slate-400 mt-1">Pilih file spreadsheet <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-700">Buku.xlsx</code></p>
          </div>

          {/* PRATINJAU DATA */}
          {previewData.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Pratinjau Data ({previewData.length} Item Siap Diimport)
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2">SKU (Kode)</th>
                      <th className="p-2">Nama Spare Part</th>
                      <th className="p-2">Satuan</th>
                      <th className="p-2">Rak</th>
                      <th className="p-2">Stok (Aktual)</th>
                      <th className="p-2">Gudang</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {previewData.slice(0, 10).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 font-mono text-[11px] text-slate-500">{item.sku || '-'}</td>
                        <td className="p-2 font-semibold text-slate-800">{item.name}</td>
                        <td className="p-2">{item.unit}</td>
                        <td className="p-2">{item.rack_location}</td>
                        <td className="p-2 font-bold text-emerald-600">{item.stock}</td>
                        <td className="p-2 font-bold text-slate-500">{item.area_location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewData.length > 10 && (
                <p className="text-[11px] text-slate-400 italic mt-1 text-right">
                  Menampilkan 10 dari {previewData.length} item...
                </p>
              )}
            </div>
          )}
        </div>

        {/* FOOTER MODAL */}
        <div className="pt-4 border-t border-slate-100 mt-4 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleImportSubmit}
            disabled={loading || previewData.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
            <span>Sinkronkan {previewData.length > 0 ? `${previewData.length} Data` : ''}</span>
          </button>
        </div>
      </div>
    </div>
  );
}