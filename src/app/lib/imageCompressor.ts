/**
 * Helper Kompresi Gambar ala WhatsApp Standard Mode
 * - Downscaling: Sisi terpanjang maks 1600px (rasio dipertahankan)
 * - Anti-Miring (iOS EXIF Fix): Mempertahankan orientasi asli foto
 * - Memory Optimized: Menggunakan Object URL alih-alih Base64
 * - Strip Metadata: Bersih dari EXIF/GPS setelah dirender di Canvas
 * - Kualitas: JPEG 70%
 */
export async function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.7
): Promise<File> {
  // Jika bukan file gambar, kembalikan file asli
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      // Bersihkan Object URL dari memori setelah loaded
      URL.revokeObjectURL(objectUrl);

      let width = img.width;
      let height = img.height;

      // 1. DOWNSCALING (Sisi terpanjang maks maxDimension)
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      // 2. RENDERING CANVAS & STRIP EXIF
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file); // Fallback ke file asli jika Canvas context gagal
        return;
      }

      // Gambar ulang foto di Canvas
      ctx.drawImage(img, 0, 0, width, height);

      // 3. EXPORT KE JPEG DENGAN KOMPRESI OPTIMAL
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          // Ganti ekstensi file menjadi .jpg
          const cleanFileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';

          const compressedFile = new File([blob], cleanFileName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };

    img.src = objectUrl;
  });
}