'use client';

import { useState, useEffect, useRef } from 'react';

interface SplashScreenProps {
  finishLoading: () => void;
  speed?: number; // 🟢 Prop opsional untuk kontrol kecepatan (1 = normal, 1.5 = lebih cepat, 0.8 = lambat)
}

export default function SplashScreen({ finishLoading, speed = 1.0 }: SplashScreenProps) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 1. Atur Kecepatan Video saat komponen dimuat
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed; // Mengubah kecepatan pemutaran
    }
  }, [speed]);

  // 2. Handler saat video selesai diputar (Otomatis menutup Splash Screen)
  const handleVideoEnded = () => {
    setIsFadingOut(true); // Efek fade out halus
    setTimeout(() => {
      finishLoading();
    }, 400); // Tunggu animasi fade out selesai
  };

  return (
    <div
      className={`fixed inset-0 z-100 flex items-center justify-center bg-black transition-opacity duration-500 ease-in-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <video
        ref={videoRef}
        src="/intro.mp4" // 👈 File video dari folder public/
        autoPlay
        muted
        playsInline // Wajib untuk iOS agar video tidak otomatis full-screen bawaan HP
        onEnded={handleVideoEnded} // Otomatis selesai saat video habis
        className="w-full h-full object-cover max-w-none" // `object-cover` membuat video memenuhi layar HP/Laptop
      />
    </div>
  );
}