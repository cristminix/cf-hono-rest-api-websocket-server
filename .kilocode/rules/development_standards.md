# Development Standards & Tooling

Pastikan semua interaksi kode dan eksekusi terminal mengikuti standar berikut:

## Package Manager

- **Selalu gunakan `pnpm`**.
- Jangan pernah menyarankan atau menggunakan `npm` atau `yarn`.
- Gunakan perintah seperti `pnpm add`, `pnpm install`, dan `pnpm run`.

## TypeScript & Execution

- **Bahasa Utama:** Selalu gunakan TypeScript (.ts atau .tsx) untuk semua file logika baru.
- **Runtime Execution:** Untuk menjalankan file TypeScript secara langsung, gunakan `npx tsx`.
- **Never use `cd`** alway use relative path from current directory
- Contoh: `npx tsx path/to/file.ts`.

## Coding Language

- Prioritaskan penulisan kode dalam TypeScript dengan tipe data yang eksplisit (strong typing).
- Hindari penggunaan file JavaScript (.js) kecuali ada batasan teknis yang sangat spesifik.
