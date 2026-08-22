/**
 * Helper untuk mengompresi gambar menggunakan HTML5 Canvas
 * @param file - File gambar asli yang dipilih pengguna
 * @param maxWidth - Lebar maksimum gambar (default: 1024px)
 * @param maxHeight - Tinggi maksimum gambar (default: 1024px)
 * @param quality - Kualitas kompresi JPEG 0.0 - 1.0 (default: 0.7)
 * @returns Promise<File> - File gambar yang sudah dikompresi
 */
export async function compressImage(
  file: File,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.7
): Promise<File> {
  // Jika bukan file gambar, kembalikan file asli
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Hitung proporsi rasio gambar
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file); // Fallback ke file asli jika canvas context gagal
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            // Buat file baru dari Blob yang terkompresi
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = (error) => reject(error);
    };

    reader.onerror = (error) => reject(error);
  });
}