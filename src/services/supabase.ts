import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonAnahtar = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonAnahtar) {
  // Geliştirme sırasında erken uyarı
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tanımlı değil. .env dosyasını doldurun.',
  );
}

export const supabase = createClient(url ?? '', anonAnahtar ?? '', {
  auth: { persistSession: true, autoRefreshToken: true },
});

// Kullanıcı adı ↔ e-posta dönüşümü.
// Arayüz kullanıcı adı + 6 haneli PIN ile çalışır; Supabase Auth e-posta + şifre ister.
// Kullanıcı adını sabit bir alan adıyla e-postaya çeviriyoruz.
export const EPOSTA_ALANI = '@taytech.local';

export function kullaniciAdindanEposta(kullaniciAdi: string): string {
  return `${kullaniciAdi.trim().toLowerCase()}${EPOSTA_ALANI}`;
}
