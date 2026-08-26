'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { Send, X, MessageSquare, Loader2 } from 'lucide-react';

interface ChatSender {
  id?: string;
  full_name: string;
  username: string;
  role: string;
}

interface ChatMessage {
  id: number;
  sender_id: string;
  message: string;
  created_at: string;
  sender: ChatSender | null;
}

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { id: string; name?: string; role?: string } | null;
}

export default function ChatDrawer({ isOpen, onClose, currentUser }: ChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Seluruh Pesan Diskusi
  const fetchMessages = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
        sender_id,
        message,
        created_at,
        sender:users!sender_id (full_name, username, role)
      `)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data as unknown as ChatMessage[]);
    }
    setLoading(false);
  }, []);

  // 2. Realtime Subscription & Load Initial Data
  useEffect(() => {
    if (!isOpen) return;

    fetchMessages();

    // Subscribe ke event INSERT pesan baru
    const channel = supabase
      .channel('chat_realtime_room')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          // Ambil detail profil sender untuk pesan baru
          const { data: senderData } = await supabase
            .from('users')
            .select('full_name, username, role')
            .eq('id', payload.new.sender_id)
            .single();

          const newMsg: ChatMessage = {
            id: payload.new.id,
            sender_id: payload.new.sender_id,
            message: payload.new.message,
            created_at: payload.new.created_at,
            sender: senderData || null,
          };

          setMessages((prev) => {
            // Cegah duplikasi jika pesan dikirim oleh diri sendiri
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, fetchMessages]);

  // 3. Auto Scroll ke Pesan Terbawah
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // 4. Handler Kirim Pesan
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    const messageText = newMessage.trim();
    setSending(true);

    try {
      const { error } = await supabase.from('chat_messages').insert([
        {
          sender_id: currentUser.id,
          message: messageText,
        },
      ]);

      if (error) throw error;
      setNewMessage('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim pesan.';
      alert(msg);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        
        {/* HEADER CHAT */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Diskusi Tim Gudang</h3>
              <p className="text-xs text-slate-500">Obrolan internal Teknisi & Admin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 transition"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* DAFTAR PESAN */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Memuat obrolan...
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Belum ada pesan. Mulai diskusikan kebutuhan barang di sini!
            </div>
          ) : (
            messages.map((msg) => {
              // Validasi berbasis ID pengirim
              const isMe = msg.sender_id === currentUser?.id;

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-400 mb-1 px-1">
                    {msg.sender?.full_name || 'Pengguna'} ({msg.sender?.role || 'TEKNISI'})
                  </span>
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                    }`}
                  >
                    {msg.message}
                  </div>
                  <span className="text-[9px] text-slate-400 mt-0.5 px-1">
                    {new Date(msg.created_at).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT PESAN */}
        <form onSubmit={handleSend} className="p-3 border-t border-slate-100 bg-white flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={currentUser ? 'Tulis pesan...' : 'Login untuk mengirim pesan'}
            disabled={!currentUser || sending}
            className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!currentUser || !newMessage.trim() || sending}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-md shadow-blue-500/20 disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}