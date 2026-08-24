'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { Send, X, MessageSquare, Loader2 } from 'lucide-react';

interface ChatMessage {
  id: number;
  message: string;
  created_at: string;
  sender: {
    full_name: string;
    username: string;
    role: string;
  } | null;
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

  // 1. Fetch Chat Messages from Database
  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
        message,
        created_at,
        sender:users!sender_id (full_name, username, role)
      `)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data as unknown as ChatMessage[]);
    }
    setLoading(false);
  };

  // 2. Realtime Listener
  useEffect(() => {
    if (!isOpen) return;

    fetchMessages();

    const channel = supabase
      .channel('chat_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen]);

  // 3. Auto Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. Send Message Handler
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    setSending(true);
    try {
      const { error } = await supabase.from('chat_messages').insert([
        {
          sender_id: currentUser.id,
          message: newMessage.trim(),
        },
      ]);

      if (error) throw error;
      setNewMessage('');
      fetchMessages();
    } catch (err: any) {
      alert(`Gagal mengirim pesan: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 pt-[max(2rem,env(safe-area-inset-top))] backdrop-blur-sm">
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
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AREA DAFTAR PESAN */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Memuat obrolan...
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Belum ada pesan. Mulai diskusikan kebutuhan barang di sini!
            </div>
          ) : (
            messages.map((msg) => {
              const isMe =
                msg.sender?.full_name === currentUser?.name ||
                msg.sender?.username === currentUser?.name;

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-400 mb-1 px-1">
                    {msg.sender?.full_name || 'Pengguna'} ({msg.sender?.role || 'USER'})
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
                  <span className="text-[9px] text-slate-300 mt-0.5 px-1">
                    {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
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

export { ChatDrawer };