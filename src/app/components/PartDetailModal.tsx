'use client';

import { useState, useEffect } from 'react';
import { X, MapPin, Tag, Cpu, AlertTriangle, Package, Image as ImageIcon, ShieldCheck, Layers } from 'lucide-react';

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

interface PartDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: SparePart | null;
  onOpenRequest?: (item: SparePart, type: 'MASUK' | 'KELUAR') => void;
  canRequest?: boolean;
}

export default function PartDetailModal({
  isOpen,
  onClose,
  item,
  onOpenRequest,
  canRequest = false,
}: PartDetailModalProps) {
  if (!isOpen || !item) return null;

  const isLowStock = item.stock <= item.min_stock;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl transition-all">
        {/* Tombol Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Gambar Produk */}
        <div className="relative mb-6 h-64 w-full overflow-hidden rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center text-slate-400">
              <ImageIcon className="w-12 h-12 mb-2" />
              <span className="text-xs font-medium">Foto fisik barang belum tersedia</span>
            </div>
          )}

          {/* Badges di atas gambar */}
          <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
            <span className="bg-slate-900/80 text-white text-xs font-semibold px-2.5 py-1 rounded-lg backdrop-blur-sm">
              {item.condition}
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm shadow-sm ${
                item.grade === 'ORIGINAL'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 text-white'
              }`}
            >
              {item.grade || 'ORIGINAL'}
            </span>
          </div>
        </div>

        {/* Info Judul & Subtitle */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-800 leading-tight mb-1">{item.name}</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-mono">
            {item.part_number && <span>PN: <strong className="text-slate-700">{item.part_number}</strong></span>}
            {item.sku && <span>SKU: <strong className="text-slate-700">{item.sku}</strong></span>}
            {item.category && <span>Kategori: <strong className="text-slate-700">{item.category}</strong></span>}
          </div>
        </div>

        {/* Grid Informasi Detail */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Lokasi Rak & Area */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-start gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">Lokasi Penyimpanan</span>
              <span className="text-sm font-bold text-slate-800">
                {item.area_location || 'Area -'} • Rak: <span className="text-blue-600">{item.rack_location || '-'}</span>
              </span>
            </div>
          </div>

          {/* Peruntukan Mesin */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-start gap-3">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">Peruntukan Mesin</span>
              <span className="text-sm font-semibold text-slate-800">
                {item.machine_target || 'Umum / Semua Mesin'}
              </span>
            </div>
          </div>

          {/* Sisa Stok */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-start gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${isLowStock ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
              <Package className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">Status Stok</span>
              <div className="flex items-center gap-2">
                <span className={`text-base font-bold ${isLowStock ? 'text-red-600' : 'text-slate-800'}`}>
                  {item.stock} {item.unit}
                </span>
                {isLowStock && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                    <AlertTriangle className="w-3 h-3" /> Stok Menipis (Min: {item.min_stock})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Kualitas / Grade */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">Kualitas Parts</span>
              <span className="text-sm font-semibold text-slate-800">
                Grade: <b>{item.grade || 'ORIGINAL'}</b> ({item.condition})
              </span>
            </div>
          </div>
        </div>

        {/* Alias / Kata Kunci */}
        {item.aliases && item.aliases.length > 0 && (
          <div className="mb-6 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider flex items-center gap-1 mb-2">
              <Tag className="w-3.5 h-3.5" /> Kata Kunci / Sebutan Lain
            </span>
            <div className="flex flex-wrap gap-1.5">
              {item.aliases.map((alias, idx) => (
                <span key={idx} className="bg-white text-slate-700 border border-slate-200 text-xs px-2.5 py-1 rounded-lg font-medium">
                  {alias}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tombol Aksi di Modal Detail */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition text-sm font-medium"
          >
            Tutup
          </button>

          {canRequest && onOpenRequest && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenRequest(item, 'MASUK');
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
              >
                + Request Tambah Stok
              </button>
              <button
                onClick={() => {
                  onClose();
                  onOpenRequest(item, 'KELUAR');
                }}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition shadow-sm"
              >
                - Request Ambil Stok
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}