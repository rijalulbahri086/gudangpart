'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { X, UserPlus, Loader2, User, Lock, ShieldCheck } from 'lucide-react';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddUserModal({ isOpen, onClose, onSuccess }: AddUserModalProps) {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'TEKNISI' | 'ADMIN'>('TEKNISI');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const resetForm = useCallback(() => {
    setUsername('');
    setFullName('');
    setPassword('');
    setRole('TEKNISI');
    setErrorMsg('');
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Bersihkan username dari spasi dan ubah ke huruf kecil
    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '');
    const autoEmail = `${cleanUsername}@gudangpart.com`;

    try {
      if (!cleanUsername) throw new Error('Username tidak boleh kosong.');
      if (password.length < 6) throw new Error('Password minimal 6 karakter.');

      // 1. Cek ketersediaan username di tabel public.users
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('username')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (checkError) console.warn('Pemeriksaan username error:', checkError.message);

      if (existingUser) {
        throw new Error('Username sudah digunakan! Gunakan username lain.');
      }

      // 2. Registrasi user ke Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: autoEmail,
        password: password,
        options: {
          data: {
            username: cleanUsername,
            full_name: fullName.trim(),
            role: role,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // 3. Simpan data profil ke public.users
        const { error: profileError } = await supabase.from('users').upsert([
          {
            id: authData.user.id,
            username: cleanUsername,
            full_name: fullName.trim(),
            role: role,
            email: autoEmail,
          },
        ]);

        if (profileError) {
          console.warn('Upsert profil gagal:', profileError.message);
        }

        alert(`Pengguna baru "${fullName}" (${role}) berhasil ditambahkan!\nEmail Login: ${autoEmail}`);

        resetForm();
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      console.error('Error adding user:', err);
      const msg = err instanceof Error ? err.message : 'Gagal menambahkan pengguna baru.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 pt-[max(2rem,env(safe-area-inset-top))] backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Tambah Pengguna Baru</h3>
              <p className="text-xs text-slate-500">Daftarkan Teknisi atau Admin baru</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            disabled={loading}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nama Lengkap */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Nama Lengkap</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Masukkan Nama Lengkap"
                disabled={loading}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                required
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username (tanpa spasi)"
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
              required
            />
            {username.trim() && (
              <span className="text-[11px] text-slate-400 mt-1 block">
                Email otomatis: <b className="text-slate-600">{username.trim().toLowerCase().replace(/\s+/g, '')}@gudangpart.com</b>
              </span>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                disabled={loading}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                minLength={6}
                required
              />
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Role / Hak Akses</label>
            <div className="grid grid-cols-2 gap-2">
              {(['TEKNISI', 'ADMIN'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={loading}
                  onClick={() => setRole(r)}
                  className={`py-2 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1.5 ${
                    role === r
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold text-sm transition disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Menyimpan...' : 'Simpan User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}