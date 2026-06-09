import { Mesaj, SohbetOturumu, TabloVerisi } from '../types';
import { supabase, kullaniciAdindanEposta } from './supabase';

// ============================================================================
// Kimlik doğrulama
// ============================================================================

// Kullanıcı adının varlığını giriş öncesi kontrol edemiyoruz (Auth gizliliği);
// 2 adımlı arayüzü korumak için geçerli kabul ediyoruz, asıl doğrulama PIN
// adımındaki girişte yapılıyor.
export async function kullaniciKontrolApi(
  _kullaniciAdi: string,
): Promise<{ gecerli: boolean; mesaj: string }> {
  return { gecerli: true, mesaj: 'Devam' };
}

export async function girisYapApi(
  kullaniciAdi: string,
  sifre: string,
): Promise<{ basarili: boolean; mesaj: string }> {
  const { error } = await supabase.auth.signInWithPassword({
    email: kullaniciAdindanEposta(kullaniciAdi),
    password: sifre,
  });
  if (error) {
    return { basarili: false, mesaj: 'Hatalı kullanıcı adı veya PIN' };
  }
  return { basarili: true, mesaj: 'Giriş başarılı' };
}

// ============================================================================
// AI sorgu (Edge Function 'ai-sorgu')
// ============================================================================
function rastgeleIdOlustur(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export async function mesajGonderApi(
  mesaj: string,
  oturumId: string | null,
): Promise<Mesaj> {
  const { data, error } = await supabase.functions.invoke('ai-sorgu', {
    body: { soru: mesaj, oturumId },
  });

  if (error || !data || data.hata) {
    const detay = String(data?.detay ?? error?.message ?? '');
    const yogun = /429|503|kota|quota|demand|exhaust|unavailable/i.test(detay);
    return {
      id: rastgeleIdOlustur(),
      rol: 'assistant',
      icerik: yogun
        ? 'Yapay zeka servisi şu anda yoğun (ücretsiz kota sınırı). Lütfen birkaç saniye sonra tekrar deneyin.'
        : 'Üzgünüm, şu anda yanıt veremiyorum. Lütfen tekrar deneyin.',
      icerikTuru: 'error',
      zamanDamgasi: Date.now(),
    };
  }

  return {
    id: rastgeleIdOlustur(),
    rol: 'assistant',
    icerik: data.icerik ?? '',
    icerikTuru: data.icerikTuru ?? 'text',
    tabloVerisi: data.tabloVerisi as TabloVerisi | undefined,
    zamanDamgasi: Date.now(),
  };
}

// ============================================================================
// Sohbet kalıcılığı (localStorage yerine Postgres)
// ============================================================================
const zamanaCevir = (ts: string | number): number =>
  typeof ts === 'number' ? ts : new Date(ts).getTime();

interface MesajSatiri {
  id: string;
  rol: 'user' | 'assistant';
  icerik: string;
  icerik_turu: Mesaj['icerikTuru'];
  tablo_verisi: TabloVerisi | null;
  zaman_damgasi: string;
}

export async function oturumlariGetirApi(): Promise<SohbetOturumu[]> {
  const { data: oturumlar, error } = await supabase
    .from('sohbet_oturumlari')
    .select('id, baslik, olusturma_tarihi, guncelleme_tarihi, mesajlar(*)')
    .order('guncelleme_tarihi', { ascending: false })
    .order('zaman_damgasi', { referencedTable: 'mesajlar', ascending: true });

  if (error || !oturumlar) return [];

  return oturumlar.map((o): SohbetOturumu => ({
    id: o.id,
    baslik: o.baslik,
    olusturmaTarihi: zamanaCevir(o.olusturma_tarihi),
    guncellemeTarihi: zamanaCevir(o.guncelleme_tarihi),
    mesajlar: ((o.mesajlar ?? []) as MesajSatiri[]).map((m): Mesaj => ({
      id: m.id,
      rol: m.rol,
      icerik: m.icerik,
      icerikTuru: m.icerik_turu,
      tabloVerisi: m.tablo_verisi ?? undefined,
      zamanDamgasi: zamanaCevir(m.zaman_damgasi),
    })),
  }));
}

export async function oturumOlusturApi(
  kullaniciId: string,
  baslik: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('sohbet_oturumlari')
    .insert({ kullanici_id: kullaniciId, baslik })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id;
}

export async function oturumBaslikGuncelleApi(id: string, baslik: string): Promise<void> {
  await supabase
    .from('sohbet_oturumlari')
    .update({ baslik, guncelleme_tarihi: new Date().toISOString() })
    .eq('id', id);
}

export async function oturumSilApi(id: string): Promise<void> {
  await supabase.from('sohbet_oturumlari').delete().eq('id', id);
}

export async function tumOturumlariSilApi(kullaniciId: string): Promise<void> {
  await supabase.from('sohbet_oturumlari').delete().eq('kullanici_id', kullaniciId);
}

// Mesajı DB'ye kaydeder ve oluşturulan satırın id'sini döndürür.
export async function mesajKaydetApi(oturumId: string, mesaj: Mesaj): Promise<string> {
  const { data } = await supabase
    .from('mesajlar')
    .insert({
      oturum_id: oturumId,
      rol: mesaj.rol,
      icerik: mesaj.icerik,
      icerik_turu: mesaj.icerikTuru,
      tablo_verisi: mesaj.tabloVerisi ?? null,
    })
    .select('id')
    .single();
  return data?.id ?? mesaj.id;
}
