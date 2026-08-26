'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface SplashScreenProps {
  finishLoading: () => void;
  speed?: number; // Prop opsional kontrol kecepatan (default 1.0)
  maxTimeoutMs?: number; // Fallback waktu maksimal (default 6000ms / 6 detik)
}

export default function SplashScreen({
  finishLoading,
  speed = 1.0,
  maxTimeoutMs = 6000,
}: SplashScreenProps) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handler utama saat splash screen selesai diputar / ditutup
  const handleComplete = useCallback(() => {
    setIsFadingOut(true);
    fadeTimeoutRef.current = setTimeout(() => {
      finishLoading();
    }, 400); // Durasi transisi fade-out (ms)
  }, [finishLoading]);

  useEffect(() => {
    const video = videoRef.current;

    if (video) {
      video.playbackRate = speed;

      // 🟢 Penanganan error interupsi ekstensi Chrome & Autoplay Policy
      const startPlayback = async () => {
        try {
          await video.play();
        } catch (err) {
          console.warn('Pemutaran video diinterupsi ekstensi browser atau autoplay diblokir:', err);
          // Jika gagal diputar karena ekstensi/kebijakan browser, langsung tutup splash screen
          handleComplete();
        }
      };

      startPlayback();
    }

    // 🟢 Safety Timer: Cegah aplikasi stuck jika video loading lama atau bermasalah
    const fallbackTimer = setTimeout(() => {
      handleComplete();
    }, maxTimeoutMs);

    return () => {
      clearTimeout(fallbackTimer);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, [speed, maxTimeoutMs, handleComplete]);

  return (
    <div
      className={`fixed inset-0 z-100 flex items-center justify-center bg-black transition-opacity duration-500 ease-in-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <video
        ref={videoRef}
        src="/intro.mp4"
        autoPlay
        muted
        playsInline
        onEnded={handleComplete}
        onError={() => {
          console.error('File video splash screen gagal dimuat atau korup.');
          handleComplete();
        }}
        className="h-full w-full object-cover max-w-none select-none pointer-events-none"
      />
    </div>
  );
}