import { createClient } from '@supabase/supabase-js';

// Varsayılan (gömülü) Supabase bağlantısı. Anon anahtar zaten tarayıcıya gönderilen,
// herkese açık olması için tasarlanmış bir anahtardır; veriyi RLS (rol kilidi) korur.
// Böylece Vercel'de env ayarı yapılmadan da uygulama çalışır. İstenirse ortam
// değişkenleriyle (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) geçersiz kılınabilir.
const VARSAYILAN_URL = 'https://afeizyfojuruzhxjkukc.supabase.co';
const VARSAYILAN_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZWl6eWZvanVydXpoeGprdWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMjIwMTQsImV4cCI6MjA5NjU5ODAxNH0.YNXhTY-q84DopWaSGND3LeeGsgw_C17vVc5Bf8shBeo';

const url = import.meta.env.VITE_SUPABASE_URL || VARSAYILAN_URL;
const anonAnahtar = import.meta.env.VITE_SUPABASE_ANON_KEY || VARSAYILAN_ANON;

export const ortamHazirMi = Boolean(url && anonAnahtar);

export const supabase = createClient(url, anonAnahtar, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// Kullanıcı adı ↔ e-posta dönüşümü.
// Arayüz kullanıcı adı + 6 haneli PIN ile çalışır; Supabase Auth e-posta + şifre ister.
// Kullanıcı adını sabit bir alan adıyla e-postaya çeviriyoruz.
export const EPOSTA_ALANI = '@taytech.local';

export function kullaniciAdindanEposta(kullaniciAdi: string): string {
  return `${kullaniciAdi.trim().toLowerCase()}${EPOSTA_ALANI}`;
}
