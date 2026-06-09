import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonAnahtar = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Ortam değişkenleri eksikse uygulama BEYAZ EKRANDA çökmesin diye güvenli yer tutucu
// kullanılır (createClient boş URL ile hata fırlatır). Bu durumda bağlantı çalışmaz
// ama arayüz açılır ve uyarı gösterilir.
export const ortamHazirMi = Boolean(url && anonAnahtar);

if (!ortamHazirMi) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tanımlı değil. ' +
    'Vercel ortam değişkenlerini (veya .env) doldurun.',
  );
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonAnahtar || 'placeholder-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true } },
);

// Kullanıcı adı ↔ e-posta dönüşümü.
// Arayüz kullanıcı adı + 6 haneli PIN ile çalışır; Supabase Auth e-posta + şifre ister.
// Kullanıcı adını sabit bir alan adıyla e-postaya çeviriyoruz.
export const EPOSTA_ALANI = '@taytech.local';

export function kullaniciAdindanEposta(kullaniciAdi: string): string {
  return `${kullaniciAdi.trim().toLowerCase()}${EPOSTA_ALANI}`;
}
