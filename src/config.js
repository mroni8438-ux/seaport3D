// Kunci publik saja. Dibaca dari berkas .env (lokal) dan Environment Variables Vercel.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const MODE_CONTOH = !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY;
