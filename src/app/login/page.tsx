'use client';

import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import { Package, Lock, User, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [usernameInput, setUsernameInput] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const cleanInput = usernameInput.trim().toLowerCase();

    try {
      let targetEmail = cleanInput;

      // 1. Cek apakah input berupa Email atau Username
      const isEmail = cleanInput.includes('@');

      if (!isEmail) {
        // Jika input adalah Username, cari data user & email aslinya di tabel public.users
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('id, username, role, email')
          .eq('username', cleanInput)
          .maybeSingle();

        if (profileError) {
          throw new Error(`Gagal memverifikasi akun: ${profileError.message}`);
        }

        if (!userProfile) {
          throw new Error('Username tidak ditemukan di database!');
        }

        if (!userProfile.email) {
          throw new Error('Email tidak terhubung dengan username ini. Hubungi Admin.');
        }

        targetEmail = userProfile.email;
      }

      // 2. Autentikasi ke Supabase Auth menggunakan Email asli & Password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          throw new Error('Password yang Anda masukkan salah.');
        }
        throw authError;
      }

      if (authData?.user) {
        // 3. Ambil Role User setelah login berhasil
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', authData.user.id)
          .maybeSingle();

        const userRole = userData?.role || 'TEKNISI';

        // Redirect berdasarkan role
        if (userRole === 'ADMIN') {
          router.push('/admin/requests');
        } else {
          router.push('/');
        }
        router.refresh();
      }
    } catch (err: any) {
      console.error('Login Error:', err);
      setErrorMsg(err.message || 'Gagal login. Silakan periksa kembali username/password Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl relative">
        {/* LOGO & TITLE */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-3 text-blue-600">
            <Package className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">GudangPart</h1>
          <p className="text-sm text-slate-500 mt-1">Masuk ke Sistem Manajemen Stok Spare Part</p>
        </div>

        {/* ALERT ERROR */}
        {errorMsg && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* FORM LOGIN USERNAME / EMAIL & PASSWORD */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Username / Email
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Masukkan username atau email"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Memverifikasi...' : 'Masuk Sekarang'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            Akses terbatas untuk Teknisi & Admin GudangPart
          </p>
        </div>
      </div>
    </div>
  );
}