import { supabase } from './supabase';
import { Bildirim } from '../types';

// ============================================================================
// Ürünler & Stok (Depo)
// ============================================================================
export interface UrunOzet {
  id: string;
  urun_kodu: string;
  urun_adi: string;
}

export async function urunleriGetir(): Promise<UrunOzet[]> {
  const { data } = await supabase
    .from('urunler')
    .select('id, urun_kodu, urun_adi')
    .eq('aktif', true)
    .order('urun_adi');
  return data ?? [];
}

export interface GuncelStokSatiri {
  urun_kodu: string;
  urun_adi: string;
  kategori: string | null;
  mevcut_stok: number;
  kritik_seviye: number;
}

export async function guncelStokGetir(): Promise<GuncelStokSatiri[]> {
  const { data } = await supabase
    .from('v_guncel_stok')
    .select('urun_kodu, urun_adi, kategori, mevcut_stok, kritik_seviye')
    .order('mevcut_stok');
  return data ?? [];
}

export async function urunEkle(girdi: {
  urun_kodu: string;
  urun_adi: string;
  kategori?: string;
  birim_fiyat?: number;
  kritik_seviye?: number;
}): Promise<{ basarili: boolean; mesaj: string }> {
  const { error } = await supabase.from('urunler').insert(girdi);
  return error
    ? { basarili: false, mesaj: error.message }
    : { basarili: true, mesaj: 'Ürün eklendi' };
}

export async function stokHareketiEkle(girdi: {
  urun_id: string;
  hareket_turu: 'giris' | 'cikis' | 'duzeltme';
  miktar: number;
  aciklama?: string;
  olusturan_id: string;
}): Promise<{ basarili: boolean; mesaj: string }> {
  const { error } = await supabase
    .from('stok_hareketleri')
    .insert({ ...girdi, kaynak: 'form' });
  return error
    ? { basarili: false, mesaj: error.message }
    : { basarili: true, mesaj: 'Hareket kaydedildi' };
}

// Excel/CSV toplu stok hareketi (kaynak='excel')
export async function topluStokHareketiEkle(
  satirlar: { urun_id: string; hareket_turu: 'giris' | 'cikis' | 'duzeltme'; miktar: number; aciklama?: string }[],
  olusturan_id: string,
): Promise<{ basarili: boolean; mesaj: string }> {
  const { error } = await supabase
    .from('stok_hareketleri')
    .insert(satirlar.map((s) => ({ ...s, kaynak: 'excel', olusturan_id })));
  return error
    ? { basarili: false, mesaj: error.message }
    : { basarili: true, mesaj: `${satirlar.length} hareket aktarıldı` };
}

// ============================================================================
// Muhasebe
// ============================================================================
export async function muhasebeEkle(girdi: {
  kayit_turu: 'gelir' | 'gider';
  tutar: number;
  kategori?: string;
  aciklama?: string;
  kayit_tarihi: string;
  olusturan_id: string;
}): Promise<{ basarili: boolean; mesaj: string }> {
  const { error } = await supabase.from('muhasebe_kayitlari').insert(girdi);
  return error
    ? { basarili: false, mesaj: error.message }
    : { basarili: true, mesaj: 'Kayıt eklendi' };
}

// ============================================================================
// Bildirimler
// ============================================================================
interface BildirimSatiri {
  id: string;
  tur: Bildirim['tur'];
  baslik: string;
  icerik: string | null;
  okundu: boolean;
  olusturma_tarihi: string;
}

export async function bildirimleriGetir(): Promise<Bildirim[]> {
  const { data } = await supabase
    .from('bildirimler')
    .select('id, tur, baslik, icerik, okundu, olusturma_tarihi')
    .order('olusturma_tarihi', { ascending: false })
    .limit(50);
  return ((data ?? []) as BildirimSatiri[]).map((b) => ({
    id: b.id,
    tur: b.tur,
    baslik: b.baslik,
    icerik: b.icerik,
    okundu: b.okundu,
    olusturmaTarihi: new Date(b.olusturma_tarihi).getTime(),
  }));
}

export async function bildirimOkunduIsaretle(id: string): Promise<void> {
  await supabase.from('bildirimler').update({ okundu: true }).eq('id', id);
}

// ============================================================================
// Müdür analitiği
// ============================================================================
export interface SorguKaydi {
  soru_metni: string;
  niyet: string;
  basarili: boolean;
  olusturma_tarihi: string;
  kullanici_adi: string;
}

export async function sorguKayitlariGetir(): Promise<SorguKaydi[]> {
  const { data } = await supabase
    .from('sorgu_kayitlari')
    .select('soru_metni, niyet, basarili, olusturma_tarihi, profiller(kullanici_adi)')
    .order('olusturma_tarihi', { ascending: false })
    .limit(100);
  // profiller join'i tek nesne döner
  return ((data ?? []) as unknown as Array<Omit<SorguKaydi, 'kullanici_adi'> & { profiller: { kullanici_adi: string } | null }>).map((r) => ({
    soru_metni: r.soru_metni,
    niyet: r.niyet,
    basarili: r.basarili,
    olusturma_tarihi: r.olusturma_tarihi,
    kullanici_adi: r.profiller?.kullanici_adi ?? '—',
  }));
}

export interface KullanimOzeti {
  niyet: string;
  kullanici_adi: string;
  adet: number;
}

export async function mudurOzetiGetir(gun = 30): Promise<KullanimOzeti[]> {
  const { data } = await supabase.rpc('mudur_kullanim_ozeti', { gun });
  return (data ?? []) as KullanimOzeti[];
}

// ============================================================================
// Genel kayıt ekleme + açılır liste yardımcıları (yeni domainler)
// ============================================================================
export async function genelEkle(
  tablo: string,
  kayit: Record<string, unknown>,
): Promise<{ basarili: boolean; mesaj: string }> {
  // Boş string alanları temizle (opsiyonel alanlar null kalsın)
  const temiz: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(kayit)) {
    if (v !== '' && v !== undefined) temiz[k] = v;
  }
  const { error } = await supabase.from(tablo).insert(temiz);
  return error
    ? { basarili: false, mesaj: error.message }
    : { basarili: true, mesaj: 'Kayıt eklendi' };
}

export interface SecenekOge {
  deger: string;
  etiket: string;
}

async function secenekGetir(tablo: string, etiketKolon: string, ekKolon?: string): Promise<SecenekOge[]> {
  const secim = ekKolon ? `id, ${etiketKolon}, ${ekKolon}` : `id, ${etiketKolon}`;
  const { data } = await supabase.from(tablo).select(secim).order(etiketKolon);
  return ((data ?? []) as unknown as Record<string, string>[]).map((r) => ({
    deger: r.id,
    etiket: ekKolon ? `${r[ekKolon]} — ${r[etiketKolon]}` : r[etiketKolon],
  }));
}

export const musteriSecenekleri = () => secenekGetir('musteriler', 'ad');
export const tedarikciSecenekleri = () => secenekGetir('tedarikciler', 'ad');
export const personelSecenekleri = () => secenekGetir('personel', 'ad_soyad');
export const cihazSecenekleri = () => secenekGetir('cihazlar', 'seri_no');
export const urunSecenekleri = () => secenekGetir('urunler', 'urun_adi', 'urun_kodu');

export async function profilSecenekleri(): Promise<SecenekOge[]> {
  const { data } = await supabase.from('profiller').select('id, kullanici_adi').order('kullanici_adi');
  return ((data ?? []) as { id: string; kullanici_adi: string }[]).map((r) => ({ deger: r.id, etiket: r.kullanici_adi }));
}

// ============================================================================
// Fatura/fiş OCR (Gemini vision → muhasebe alanları)
// ============================================================================
export interface FaturaAlanlari {
  kayit_turu?: 'gelir' | 'gider';
  tutar?: number;
  kategori?: string;
  aciklama?: string;
  belge_no?: string;
  kayit_tarihi?: string;
}

export async function faturaOku(gorselBase64: string, mimeType: string): Promise<FaturaAlanlari | null> {
  const { data, error } = await supabase.functions.invoke('fatura-oku', {
    body: { gorselBase64, mimeType },
  });
  if (error || !data || data.hata) return null;
  return (data.alanlar ?? null) as FaturaAlanlari | null;
}
