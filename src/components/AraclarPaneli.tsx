import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { birlesik } from '../utils/cn';
import { temaKullan } from '../context/ThemeContext';
import { Rol } from '../types';
import GenelKayitFormu, { Alan } from './GenelKayitFormu';
import {
  urunleriGetir,
  urunEkle,
  stokHareketiEkle,
  muhasebeEkle,
  topluStokHareketiEkle,
  sorguKayitlariGetir,
  mudurOzetiGetir,
  guncelStokGetir,
  musteriSecenekleri,
  tedarikciSecenekleri,
  personelSecenekleri,
  cihazSecenekleri,
  urunSecenekleri,
  profilSecenekleri,
  faturaOku,
  UrunOzet,
  SorguKaydi,
  KullanimOzeti,
  GuncelStokSatiri,
} from '../services/veriServis';

// Statik seçenek yardımcısı
const sec = (arr: string[]) => arr.map((v) => ({ deger: v, etiket: v }));

// Rol bazlı genel veri giriş sekmeleri (şema-tabanlı formlar)
interface GenelSekme {
  id: string;
  etiket: string;
  roller: Rol[];
  tablo: string;
  alanlar: Alan[];
  olusturanGerek?: boolean; // ekVeri.olusturan_id = kullaniciId
}

const GENEL_SEKMELER: GenelSekme[] = [
  {
    id: 'musteri', etiket: 'Müşteri', roller: ['mudur', 'muhasebe', 'resepsiyon'], tablo: 'musteriler',
    alanlar: [
      { ad: 'ad', etiket: 'Ünvan / Ad', tip: 'text', zorunlu: true },
      { ad: 'tip', etiket: 'Tip', tip: 'select', secenekler: sec(['firma', 'bireysel']), varsayilan: 'firma' },
      { ad: 'sehir', etiket: 'Şehir', tip: 'text' },
      { ad: 'ulke', etiket: 'Ülke', tip: 'select', secenekler: sec(['TR', 'UK']), varsayilan: 'TR' },
      { ad: 'telefon', etiket: 'Telefon', tip: 'text' },
      { ad: 'eposta', etiket: 'E-posta', tip: 'text' },
    ],
  },
  {
    id: 'teklif', etiket: 'Teklif', roller: ['mudur', 'muhasebe', 'resepsiyon'], tablo: 'teklifler', olusturanGerek: true,
    alanlar: [
      { ad: 'musteri_id', etiket: 'Müşteri', tip: 'dinamikSelect', kaynak: musteriSecenekleri },
      { ad: 'teklif_no', etiket: 'Teklif No', tip: 'text' },
      { ad: 'baslik', etiket: 'Başlık', tip: 'text' },
      { ad: 'tutar', etiket: 'Tutar (₺)', tip: 'number', zorunlu: true },
      { ad: 'durum', etiket: 'Durum', tip: 'select', secenekler: sec(['taslak', 'gonderildi', 'kazanildi', 'kaybedildi']), varsayilan: 'taslak' },
      { ad: 'gecerlilik_tarihi', etiket: 'Geçerlilik', tip: 'date' },
    ],
  },
  {
    id: 'siparis', etiket: 'Sipariş', roller: ['mudur', 'muhasebe', 'depo', 'resepsiyon'], tablo: 'siparisler',
    alanlar: [
      { ad: 'musteri_id', etiket: 'Müşteri', tip: 'dinamikSelect', kaynak: musteriSecenekleri },
      { ad: 'siparis_no', etiket: 'Sipariş No', tip: 'text' },
      { ad: 'tutar', etiket: 'Tutar (₺)', tip: 'number', zorunlu: true },
      { ad: 'durum', etiket: 'Durum', tip: 'select', secenekler: sec(['hazirlaniyor', 'sevk_edildi', 'teslim', 'iptal']), varsayilan: 'hazirlaniyor' },
      { ad: 'siparis_tarihi', etiket: 'Sipariş Tarihi', tip: 'date' },
      { ad: 'lokasyon', etiket: 'Lokasyon', tip: 'select', secenekler: sec(['TR', 'UK']), varsayilan: 'TR' },
    ],
  },
  {
    id: 'cari', etiket: 'Cari Hareket', roller: ['mudur', 'muhasebe'], tablo: 'cari_hareketler',
    alanlar: [
      { ad: 'musteri_id', etiket: 'Müşteri', tip: 'dinamikSelect', kaynak: musteriSecenekleri, zorunlu: true },
      { ad: 'hareket_turu', etiket: 'Tür', tip: 'select', secenekler: sec(['borc', 'alacak']), varsayilan: 'borc', zorunlu: true },
      { ad: 'tutar', etiket: 'Tutar (₺)', tip: 'number', zorunlu: true },
      { ad: 'vade_tarihi', etiket: 'Vade', tip: 'date' },
      { ad: 'aciklama', etiket: 'Açıklama', tip: 'text' },
    ],
  },
  {
    id: 'tedarikci', etiket: 'Tedarikçi', roller: ['mudur', 'depo'], tablo: 'tedarikciler',
    alanlar: [
      { ad: 'ad', etiket: 'Ad', tip: 'text', zorunlu: true },
      { ad: 'telefon', etiket: 'Telefon', tip: 'text' },
      { ad: 'eposta', etiket: 'E-posta', tip: 'text' },
      { ad: 'tedarik_suresi_gun', etiket: 'Tedarik Süresi (gün)', tip: 'number', varsayilan: '7' },
    ],
  },
  {
    id: 'satinalma', etiket: 'Satın Alma', roller: ['mudur', 'depo'], tablo: 'satin_alma', olusturanGerek: true,
    alanlar: [
      { ad: 'tedarikci_id', etiket: 'Tedarikçi', tip: 'dinamikSelect', kaynak: tedarikciSecenekleri },
      { ad: 'urun_id', etiket: 'Ürün', tip: 'dinamikSelect', kaynak: urunSecenekleri },
      { ad: 'miktar', etiket: 'Miktar', tip: 'number' },
      { ad: 'tutar', etiket: 'Tutar (₺)', tip: 'number' },
      { ad: 'durum', etiket: 'Durum', tip: 'select', secenekler: sec(['taslak', 'siparis', 'teslim', 'iptal']), varsayilan: 'taslak' },
      { ad: 'aciklama', etiket: 'Açıklama', tip: 'textarea' },
    ],
  },
  {
    id: 'cihaz', etiket: 'Cihaz', roller: ['mudur', 'depo'], tablo: 'cihazlar',
    alanlar: [
      { ad: 'seri_no', etiket: 'Seri No', tip: 'text', zorunlu: true },
      { ad: 'urun_id', etiket: 'Ürün', tip: 'dinamikSelect', kaynak: urunSecenekleri },
      { ad: 'musteri_id', etiket: 'Müşteri', tip: 'dinamikSelect', kaynak: musteriSecenekleri },
      { ad: 'lokasyon', etiket: 'Lokasyon', tip: 'text' },
      { ad: 'kurulum_tarihi', etiket: 'Kurulum Tarihi', tip: 'date' },
      { ad: 'garanti_bitis', etiket: 'Garanti Bitiş', tip: 'date' },
      { ad: 'durum', etiket: 'Durum', tip: 'select', secenekler: sec(['aktif', 'arizali', 'bakimda', 'pasif']), varsayilan: 'aktif' },
    ],
  },
  {
    id: 'servis', etiket: 'Servis Kaydı', roller: ['mudur', 'depo'], tablo: 'servis_kayitlari',
    alanlar: [
      { ad: 'cihaz_id', etiket: 'Cihaz', tip: 'dinamikSelect', kaynak: cihazSecenekleri },
      { ad: 'musteri_id', etiket: 'Müşteri', tip: 'dinamikSelect', kaynak: musteriSecenekleri },
      { ad: 'tur', etiket: 'Tür', tip: 'select', secenekler: sec(['planli_bakim', 'ariza', 'kurulum']), varsayilan: 'ariza' },
      { ad: 'durum', etiket: 'Durum', tip: 'select', secenekler: sec(['acik', 'devam', 'cozuldu', 'iptal']), varsayilan: 'acik' },
      { ad: 'oncelik', etiket: 'Öncelik', tip: 'select', secenekler: sec(['dusuk', 'orta', 'yuksek']), varsayilan: 'orta' },
      { ad: 'atanan_id', etiket: 'Atanan', tip: 'dinamikSelect', kaynak: profilSecenekleri },
      { ad: 'aciklama', etiket: 'Açıklama', tip: 'textarea' },
    ],
  },
  {
    id: 'bles', etiket: 'BLES Ölçüm', roller: ['mudur', 'depo'], tablo: 'bles_olcumleri',
    alanlar: [
      { ad: 'cihaz_id', etiket: 'Cihaz', tip: 'dinamikSelect', kaynak: cihazSecenekleri },
      { ad: 'site_adi', etiket: 'Site', tip: 'text' },
      { ad: 'sayac_no', etiket: 'Sayaç No', tip: 'text' },
      { ad: 'enerji_kwh', etiket: 'Enerji (kWh)', tip: 'number' },
      { ad: 'sicaklik', etiket: 'Sıcaklık (°C)', tip: 'number' },
    ],
  },
  {
    id: 'personel', etiket: 'Personel', roller: ['mudur', 'muhasebe'], tablo: 'personel',
    alanlar: [
      { ad: 'ad_soyad', etiket: 'Ad Soyad', tip: 'text', zorunlu: true },
      { ad: 'departman', etiket: 'Departman', tip: 'text' },
      { ad: 'pozisyon', etiket: 'Pozisyon', tip: 'text' },
      { ad: 'ise_giris', etiket: 'İşe Giriş', tip: 'date' },
      { ad: 'izin_hakki', etiket: 'Yıllık İzin Hakkı', tip: 'number', varsayilan: '14' },
    ],
  },
  {
    id: 'izin', etiket: 'İzin', roller: ['mudur', 'muhasebe'], tablo: 'izinler',
    alanlar: [
      { ad: 'personel_id', etiket: 'Personel', tip: 'dinamikSelect', kaynak: personelSecenekleri, zorunlu: true },
      { ad: 'tur', etiket: 'Tür', tip: 'select', secenekler: sec(['yillik', 'hastalik', 'ucretsiz', 'mazeret']), varsayilan: 'yillik' },
      { ad: 'baslangic', etiket: 'Başlangıç', tip: 'date', zorunlu: true },
      { ad: 'bitis', etiket: 'Bitiş', tip: 'date', zorunlu: true },
      { ad: 'gun', etiket: 'Gün', tip: 'number' },
      { ad: 'durum', etiket: 'Durum', tip: 'select', secenekler: sec(['talep', 'onayli', 'red']), varsayilan: 'talep' },
    ],
  },
  {
    id: 'gorev', etiket: 'Görev', roller: ['mudur', 'muhasebe', 'depo', 'resepsiyon'], tablo: 'gorevler', olusturanGerek: true,
    alanlar: [
      { ad: 'baslik', etiket: 'Başlık', tip: 'text', zorunlu: true },
      { ad: 'atanan_id', etiket: 'Atanan', tip: 'dinamikSelect', kaynak: profilSecenekleri },
      { ad: 'son_tarih', etiket: 'Son Tarih', tip: 'date' },
      { ad: 'oncelik', etiket: 'Öncelik', tip: 'select', secenekler: sec(['dusuk', 'orta', 'yuksek']), varsayilan: 'orta' },
      { ad: 'durum', etiket: 'Durum', tip: 'select', secenekler: sec(['acik', 'devam', 'tamam', 'iptal']), varsayilan: 'acik' },
      { ad: 'aciklama', etiket: 'Açıklama', tip: 'textarea' },
    ],
  },
];

interface AraclarPaneliProps {
  acik: boolean;
  kapatFn: () => void;
  rol: Rol;
  kullaniciId: string;
}

const NIYET_ETIKET: Record<string, string> = {
  stok_sorgu: 'Stok Sorgusu',
  muhasebe_sorgu: 'Muhasebe',
  satis_analiz: 'Satış Analizi',
  cari_sorgu: 'Cari/Tahsilat',
  tedarik_sorgu: 'Tedarik',
  cihaz_sorgu: 'Cihaz/Garanti',
  servis_sorgu: 'Servis',
  bles_sorgu: 'BLES',
  ik_sorgu: 'İK/İzin',
  gorev_sorgu: 'Görev',
  tahmin: 'Tahmin',
  sikayet: 'Şikayet',
  kisisel_kullanim: 'Kişisel Kullanım',
  diger: 'Diğer',
};

export default function AraclarPaneli({ acik, kapatFn, rol, kullaniciId }: AraclarPaneliProps) {
  const { temaKoyuMu } = temaKullan();

  const sekmeler = useMemo<{ id: string; etiket: string }[]>(() => {
    const liste: { id: string; etiket: string }[] = [];
    if (rol === 'depo' || rol === 'mudur') {
      liste.push({ id: 'stok', etiket: 'Stok Hareketi' });
      liste.push({ id: 'urun', etiket: 'Ürün Ekle' });
      liste.push({ id: 'excel', etiket: 'Excel Yükle' });
    }
    if (rol === 'muhasebe' || rol === 'mudur') {
      liste.push({ id: 'muhasebe', etiket: 'Muhasebe Kaydı' });
    }
    // Genel (şema-tabanlı) sekmeler
    GENEL_SEKMELER.filter((g) => g.roller.includes(rol)).forEach((g) =>
      liste.push({ id: g.id, etiket: g.etiket }),
    );
    if (rol === 'mudur') {
      liste.push({ id: 'panel', etiket: 'Müdür Paneli' });
    }
    return liste;
  }, [rol]);

  const [sekme, sekmeAyarla] = useState<string>('stok');

  useEffect(() => {
    if (sekmeler.length && !sekmeler.find((s) => s.id === sekme)) {
      sekmeAyarla(sekmeler[0].id);
    }
  }, [sekmeler, sekme]);

  if (!acik) return null;

  const kart = temaKoyuMu ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200';
  const metin = temaKoyuMu ? 'text-neutral-200' : 'text-neutral-800';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={kapatFn} />
      <div className={birlesik('relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col', kart)}>
        {/* Başlık */}
        <div className={birlesik('flex items-center justify-between px-5 py-4 border-b', temaKoyuMu ? 'border-neutral-800' : 'border-neutral-100')}>
          <h2 className={birlesik('text-lg font-semibold', metin)}>Veri Araçları</h2>
          <button onClick={kapatFn} className={birlesik('p-1.5 rounded-lg', temaKoyuMu ? 'text-neutral-400 hover:bg-neutral-800' : 'text-neutral-500 hover:bg-neutral-100')}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sekmeler */}
        <div className={birlesik('flex gap-1 px-4 pt-3 overflow-x-auto', temaKoyuMu ? 'bg-neutral-900' : 'bg-white')}>
          {sekmeler.map((s) => (
            <button
              key={s.id}
              onClick={() => sekmeAyarla(s.id)}
              className={birlesik(
                'px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                sekme === s.id
                  ? temaKoyuMu ? 'bg-neutral-700 text-white' : 'bg-neutral-200 text-neutral-900'
                  : temaKoyuMu ? 'text-neutral-400 hover:bg-neutral-800' : 'text-neutral-500 hover:bg-neutral-100',
              )}
            >
              {s.etiket}
            </button>
          ))}
        </div>

        {/* İçerik */}
        <div className="p-5 overflow-y-auto">
          {sekme === 'stok' && <StokFormu kullaniciId={kullaniciId} />}
          {sekme === 'urun' && <UrunFormu />}
          {sekme === 'excel' && <ExcelYukle kullaniciId={kullaniciId} />}
          {sekme === 'muhasebe' && <MuhasebeFormu kullaniciId={kullaniciId} />}
          {sekme === 'panel' && <MudurPaneli />}
          {(() => {
            const g = GENEL_SEKMELER.find((x) => x.id === sekme);
            if (!g) return null;
            return (
              <GenelKayitFormu
                key={g.id}
                tablo={g.tablo}
                alanlar={g.alanlar}
                ekVeri={g.olusturanGerek ? { olusturan_id: kullaniciId } : undefined}
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ortak stil yardımcıları
// ---------------------------------------------------------------------------
function girdiSinifi(koyu: boolean) {
  return birlesik(
    'w-full px-3 py-2.5 rounded-lg text-sm border-2 transition-colors outline-none',
    koyu
      ? 'bg-neutral-800 border-neutral-700 text-white focus:border-neutral-500 placeholder-neutral-500'
      : 'bg-neutral-50 border-neutral-200 text-neutral-900 focus:border-neutral-400 placeholder-neutral-400',
  );
}
function etiketSinifi(koyu: boolean) {
  return birlesik('block text-xs font-medium mb-1.5 uppercase tracking-wide', koyu ? 'text-neutral-400' : 'text-neutral-500');
}
function butonSinifi(koyu: boolean) {
  return birlesik(
    'w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
    koyu ? 'bg-neutral-200 text-neutral-900 hover:bg-white' : 'bg-neutral-900 text-white hover:bg-neutral-800',
  );
}
function Geri({ mesaj }: { mesaj: { tip: 'ok' | 'hata'; metin: string } | null }) {
  if (!mesaj) return null;
  return (
    <p className={birlesik('text-sm mt-1', mesaj.tip === 'ok' ? 'text-green-500' : 'text-red-500')}>
      {mesaj.metin}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Stok hareketi formu
// ---------------------------------------------------------------------------
function StokFormu({ kullaniciId }: { kullaniciId: string }) {
  const { temaKoyuMu } = temaKullan();
  const [urunler, urunlerAyarla] = useState<UrunOzet[]>([]);
  const [urunId, urunIdAyarla] = useState('');
  const [tur, turAyarla] = useState<'giris' | 'cikis' | 'duzeltme'>('giris');
  const [miktar, miktarAyarla] = useState('');
  const [aciklama, aciklamaAyarla] = useState('');
  const [mesaj, mesajAyarla] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(null);
  const [yukleniyor, yukleniyorAyarla] = useState(false);

  useEffect(() => {
    urunleriGetir().then((u) => {
      urunlerAyarla(u);
      if (u.length) urunIdAyarla(u[0].id);
    });
  }, []);

  const gonder = async () => {
    const m = parseInt(miktar, 10);
    if (!urunId || !m || m <= 0) {
      mesajAyarla({ tip: 'hata', metin: 'Ürün ve geçerli miktar girin.' });
      return;
    }
    yukleniyorAyarla(true);
    const sonuc = await stokHareketiEkle({ urun_id: urunId, hareket_turu: tur, miktar: m, aciklama, olusturan_id: kullaniciId });
    yukleniyorAyarla(false);
    mesajAyarla({ tip: sonuc.basarili ? 'ok' : 'hata', metin: sonuc.mesaj });
    if (sonuc.basarili) {
      miktarAyarla('');
      aciklamaAyarla('');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={etiketSinifi(temaKoyuMu)}>Ürün</label>
        <select className={girdiSinifi(temaKoyuMu)} value={urunId} onChange={(e) => urunIdAyarla(e.target.value)}>
          {urunler.map((u) => (
            <option key={u.id} value={u.id}>{u.urun_kodu} — {u.urun_adi}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={etiketSinifi(temaKoyuMu)}>Hareket</label>
          <select className={girdiSinifi(temaKoyuMu)} value={tur} onChange={(e) => turAyarla(e.target.value as 'giris' | 'cikis' | 'duzeltme')}>
            <option value="giris">Giriş</option>
            <option value="cikis">Çıkış</option>
            <option value="duzeltme">Düzeltme</option>
          </select>
        </div>
        <div>
          <label className={etiketSinifi(temaKoyuMu)}>Miktar</label>
          <input className={girdiSinifi(temaKoyuMu)} type="number" value={miktar} onChange={(e) => miktarAyarla(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div>
        <label className={etiketSinifi(temaKoyuMu)}>Açıklama (opsiyonel)</label>
        <input className={girdiSinifi(temaKoyuMu)} value={aciklama} onChange={(e) => aciklamaAyarla(e.target.value)} placeholder="örn: Satış, üretim sarfı..." />
      </div>
      <button className={butonSinifi(temaKoyuMu)} onClick={gonder} disabled={yukleniyor}>
        {yukleniyor ? 'Kaydediliyor...' : 'Hareketi Kaydet'}
      </button>
      <Geri mesaj={mesaj} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ürün ekleme formu
// ---------------------------------------------------------------------------
function UrunFormu() {
  const { temaKoyuMu } = temaKullan();
  const [kod, kodAyarla] = useState('');
  const [ad, adAyarla] = useState('');
  const [kategori, kategoriAyarla] = useState('');
  const [fiyat, fiyatAyarla] = useState('');
  const [kritik, kritikAyarla] = useState('');
  const [mesaj, mesajAyarla] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(null);
  const [yukleniyor, yukleniyorAyarla] = useState(false);

  const gonder = async () => {
    if (!kod.trim() || !ad.trim()) {
      mesajAyarla({ tip: 'hata', metin: 'Ürün kodu ve adı zorunlu.' });
      return;
    }
    yukleniyorAyarla(true);
    const sonuc = await urunEkle({
      urun_kodu: kod.trim(),
      urun_adi: ad.trim(),
      kategori: kategori.trim() || undefined,
      birim_fiyat: fiyat ? parseFloat(fiyat) : undefined,
      kritik_seviye: kritik ? parseInt(kritik, 10) : undefined,
    });
    yukleniyorAyarla(false);
    mesajAyarla({ tip: sonuc.basarili ? 'ok' : 'hata', metin: sonuc.mesaj });
    if (sonuc.basarili) {
      kodAyarla(''); adAyarla(''); kategoriAyarla(''); fiyatAyarla(''); kritikAyarla('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={etiketSinifi(temaKoyuMu)}>Ürün Kodu</label>
          <input className={girdiSinifi(temaKoyuMu)} value={kod} onChange={(e) => kodAyarla(e.target.value)} placeholder="SH-A01" />
        </div>
        <div>
          <label className={etiketSinifi(temaKoyuMu)}>Kategori</label>
          <input className={girdiSinifi(temaKoyuMu)} value={kategori} onChange={(e) => kategoriAyarla(e.target.value)} placeholder="Filtre" />
        </div>
      </div>
      <div>
        <label className={etiketSinifi(temaKoyuMu)}>Ürün Adı</label>
        <input className={girdiSinifi(temaKoyuMu)} value={ad} onChange={(e) => adAyarla(e.target.value)} placeholder="SmartHexa A++ Isı İstasyonu" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={etiketSinifi(temaKoyuMu)}>Birim Fiyat (₺)</label>
          <input className={girdiSinifi(temaKoyuMu)} type="number" value={fiyat} onChange={(e) => fiyatAyarla(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className={etiketSinifi(temaKoyuMu)}>Kritik Stok Seviyesi</label>
          <input className={girdiSinifi(temaKoyuMu)} type="number" value={kritik} onChange={(e) => kritikAyarla(e.target.value)} placeholder="10" />
        </div>
      </div>
      <button className={butonSinifi(temaKoyuMu)} onClick={gonder} disabled={yukleniyor}>
        {yukleniyor ? 'Ekleniyor...' : 'Ürünü Ekle'}
      </button>
      <Geri mesaj={mesaj} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Excel/CSV ile toplu stok hareketi
// Beklenen sütunlar: urun_kodu, hareket_turu (giris/cikis/duzeltme), miktar, aciklama
// ---------------------------------------------------------------------------
interface ExcelSatir { urun_kodu: string; hareket_turu: string; miktar: number; aciklama?: string }

function ExcelYukle({ kullaniciId }: { kullaniciId: string }) {
  const { temaKoyuMu } = temaKullan();
  const [onizleme, onizlemeAyarla] = useState<ExcelSatir[]>([]);
  const [mesaj, mesajAyarla] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(null);
  const [yukleniyor, yukleniyorAyarla] = useState(false);
  const [urunler, urunlerAyarla] = useState<UrunOzet[]>([]);

  useEffect(() => { urunleriGetir().then(urunlerAyarla); }, []);

  const dosyaSec = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    mesajAyarla(null);
    const tampon = await dosya.arrayBuffer();
    const kitap = XLSX.read(tampon);
    const sayfa = kitap.Sheets[kitap.SheetNames[0]];
    const satirlar = XLSX.utils.sheet_to_json<Record<string, unknown>>(sayfa);
    const donus: ExcelSatir[] = satirlar.map((s) => ({
      urun_kodu: String(s.urun_kodu ?? s.UrunKodu ?? s['Ürün Kodu'] ?? '').trim(),
      hareket_turu: String(s.hareket_turu ?? s.Hareket ?? 'giris').trim().toLowerCase(),
      miktar: Number(s.miktar ?? s.Miktar ?? 0),
      aciklama: s.aciklama ? String(s.aciklama) : undefined,
    })).filter((s) => s.urun_kodu && s.miktar > 0);
    onizlemeAyarla(donus);
    if (!donus.length) mesajAyarla({ tip: 'hata', metin: 'Geçerli satır bulunamadı. Sütunlar: urun_kodu, hareket_turu, miktar.' });
  };

  const aktar = async () => {
    const kodMap = new Map(urunler.map((u) => [u.urun_kodu.toLowerCase(), u.id]));
    const hazir = onizleme
      .map((s) => {
        const id = kodMap.get(s.urun_kodu.toLowerCase());
        const tur = ['giris', 'cikis', 'duzeltme'].includes(s.hareket_turu) ? s.hareket_turu : 'giris';
        return id ? { urun_id: id, hareket_turu: tur as 'giris' | 'cikis' | 'duzeltme', miktar: s.miktar, aciklama: s.aciklama } : null;
      })
      .filter(Boolean) as { urun_id: string; hareket_turu: 'giris' | 'cikis' | 'duzeltme'; miktar: number; aciklama?: string }[];

    if (!hazir.length) {
      mesajAyarla({ tip: 'hata', metin: 'Eşleşen ürün kodu yok. Önce ürünleri ekleyin.' });
      return;
    }
    yukleniyorAyarla(true);
    const sonuc = await topluStokHareketiEkle(hazir, kullaniciId);
    yukleniyorAyarla(false);
    mesajAyarla({ tip: sonuc.basarili ? 'ok' : 'hata', metin: sonuc.mesaj });
    if (sonuc.basarili) onizlemeAyarla([]);
  };

  return (
    <div className="space-y-4">
      <p className={birlesik('text-sm', temaKoyuMu ? 'text-neutral-400' : 'text-neutral-500')}>
        Excel/CSV sütunları: <code>urun_kodu</code>, <code>hareket_turu</code> (giris/cikis/duzeltme), <code>miktar</code>, <code>aciklama</code>.
      </p>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={dosyaSec} className={birlesik('text-sm', temaKoyuMu ? 'text-neutral-300' : 'text-neutral-700')} />

      {onizleme.length > 0 && (
        <div className={birlesik('rounded-lg border overflow-hidden', temaKoyuMu ? 'border-neutral-700' : 'border-neutral-200')}>
          <div className={birlesik('px-3 py-2 text-xs font-medium', temaKoyuMu ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-100 text-neutral-600')}>
            {onizleme.length} satır önizleme
          </div>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {onizleme.slice(0, 50).map((s, i) => (
                  <tr key={i} className={temaKoyuMu ? 'text-neutral-300 border-t border-neutral-800' : 'text-neutral-700 border-t border-neutral-100'}>
                    <td className="px-3 py-1.5">{s.urun_kodu}</td>
                    <td className="px-3 py-1.5">{s.hareket_turu}</td>
                    <td className="px-3 py-1.5">{s.miktar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {onizleme.length > 0 && (
        <button className={butonSinifi(temaKoyuMu)} onClick={aktar} disabled={yukleniyor}>
          {yukleniyor ? 'Aktarılıyor...' : 'İçe Aktar'}
        </button>
      )}
      <Geri mesaj={mesaj} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Muhasebe kaydı formu
// ---------------------------------------------------------------------------
function MuhasebeFormu({ kullaniciId }: { kullaniciId: string }) {
  const { temaKoyuMu } = temaKullan();
  const [tur, turAyarla] = useState<'gelir' | 'gider'>('gelir');
  const [tutar, tutarAyarla] = useState('');
  const [kategori, kategoriAyarla] = useState('');
  const [aciklama, aciklamaAyarla] = useState('');
  const [tarih, tarihAyarla] = useState(new Date().toISOString().slice(0, 10));
  const [mesaj, mesajAyarla] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(null);
  const [yukleniyor, yukleniyorAyarla] = useState(false);
  const [ocrYukleniyor, ocrYukleniyorAyarla] = useState(false);

  const faturaSec = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    ocrYukleniyorAyarla(true);
    mesajAyarla(null);
    try {
      const base64 = await new Promise<string>((coz, hata) => {
        const fr = new FileReader();
        fr.onload = () => coz(String(fr.result).split(',')[1] ?? '');
        fr.onerror = hata;
        fr.readAsDataURL(dosya);
      });
      const alanlar = await faturaOku(base64, dosya.type || 'image/jpeg');
      if (!alanlar) {
        mesajAyarla({ tip: 'hata', metin: 'Fatura okunamadı, alanları elle girin.' });
      } else {
        if (alanlar.kayit_turu === 'gelir' || alanlar.kayit_turu === 'gider') turAyarla(alanlar.kayit_turu);
        if (alanlar.tutar) tutarAyarla(String(alanlar.tutar));
        if (alanlar.kategori) kategoriAyarla(alanlar.kategori);
        if (alanlar.aciklama) aciklamaAyarla(alanlar.aciklama);
        if (alanlar.kayit_tarihi) tarihAyarla(alanlar.kayit_tarihi);
        mesajAyarla({ tip: 'ok', metin: 'Fatura okundu, alanları kontrol edip kaydedin.' });
      }
    } catch {
      mesajAyarla({ tip: 'hata', metin: 'Fatura işlenemedi.' });
    } finally {
      ocrYukleniyorAyarla(false);
    }
  };

  const gonder = async () => {
    const t = parseFloat(tutar);
    if (!t || t <= 0) {
      mesajAyarla({ tip: 'hata', metin: 'Geçerli bir tutar girin.' });
      return;
    }
    yukleniyorAyarla(true);
    const sonuc = await muhasebeEkle({
      kayit_turu: tur, tutar: t, kategori: kategori.trim() || undefined,
      aciklama: aciklama.trim() || undefined, kayit_tarihi: tarih, olusturan_id: kullaniciId,
    });
    yukleniyorAyarla(false);
    mesajAyarla({ tip: sonuc.basarili ? 'ok' : 'hata', metin: sonuc.mesaj });
    if (sonuc.basarili) { tutarAyarla(''); kategoriAyarla(''); aciklamaAyarla(''); }
  };

  return (
    <div className="space-y-4">
      {/* Fatura/fiş OCR ile otomatik doldur */}
      <div className={birlesik('rounded-lg border border-dashed p-3', temaKoyuMu ? 'border-neutral-700' : 'border-neutral-300')}>
        <label className={birlesik('block text-xs font-medium mb-1.5', temaKoyuMu ? 'text-neutral-400' : 'text-neutral-500')}>
          📷 Fatura/fiş fotoğrafı yükle (AI otomatik doldursun)
        </label>
        <input type="file" accept="image/*" onChange={faturaSec} disabled={ocrYukleniyor}
          className={birlesik('text-sm', temaKoyuMu ? 'text-neutral-300' : 'text-neutral-700')} />
        {ocrYukleniyor && <p className="text-xs text-neutral-500 mt-1">Fatura okunuyor...</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={etiketSinifi(temaKoyuMu)}>Tür</label>
          <select className={girdiSinifi(temaKoyuMu)} value={tur} onChange={(e) => turAyarla(e.target.value as 'gelir' | 'gider')}>
            <option value="gelir">Gelir</option>
            <option value="gider">Gider</option>
          </select>
        </div>
        <div>
          <label className={etiketSinifi(temaKoyuMu)}>Tutar (₺)</label>
          <input className={girdiSinifi(temaKoyuMu)} type="number" value={tutar} onChange={(e) => tutarAyarla(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={etiketSinifi(temaKoyuMu)}>Kategori</label>
          <input className={girdiSinifi(temaKoyuMu)} value={kategori} onChange={(e) => kategoriAyarla(e.target.value)} placeholder="satis, maas, kira..." />
        </div>
        <div>
          <label className={etiketSinifi(temaKoyuMu)}>Tarih</label>
          <input className={girdiSinifi(temaKoyuMu)} type="date" value={tarih} onChange={(e) => tarihAyarla(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={etiketSinifi(temaKoyuMu)}>Açıklama (opsiyonel)</label>
        <input className={girdiSinifi(temaKoyuMu)} value={aciklama} onChange={(e) => aciklamaAyarla(e.target.value)} placeholder="örn: SmartHexa satışı" />
      </div>
      <button className={butonSinifi(temaKoyuMu)} onClick={gonder} disabled={yukleniyor}>
        {yukleniyor ? 'Kaydediliyor...' : 'Kaydı Ekle'}
      </button>
      <Geri mesaj={mesaj} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Müdür paneli: kullanım özeti + son sorgular + güncel stok
// ---------------------------------------------------------------------------
function MudurPaneli() {
  const { temaKoyuMu } = temaKullan();
  const [ozet, ozetAyarla] = useState<KullanimOzeti[]>([]);
  const [sorgular, sorgularAyarla] = useState<SorguKaydi[]>([]);
  const [stok, stokAyarla] = useState<GuncelStokSatiri[]>([]);

  useEffect(() => {
    mudurOzetiGetir(30).then(ozetAyarla);
    sorguKayitlariGetir().then(sorgularAyarla);
    guncelStokGetir().then(stokAyarla);
  }, []);

  const baslik = birlesik('text-sm font-semibold mb-2', temaKoyuMu ? 'text-neutral-200' : 'text-neutral-800');
  const kutu = birlesik('rounded-lg border overflow-hidden', temaKoyuMu ? 'border-neutral-700' : 'border-neutral-200');
  const satirR = temaKoyuMu ? 'text-neutral-300 border-t border-neutral-800' : 'text-neutral-700 border-t border-neutral-100';

  return (
    <div className="space-y-6">
      <div>
        <h3 className={baslik}>Kullanım Özeti (son 30 gün) — kim, ne amaçla?</h3>
        <div className={kutu}>
          <table className="w-full text-sm">
            <thead className={temaKoyuMu ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-100 text-neutral-500'}>
              <tr><th className="px-3 py-2 text-left">Kullanıcı</th><th className="px-3 py-2 text-left">Niyet</th><th className="px-3 py-2 text-right">Adet</th></tr>
            </thead>
            <tbody>
              {ozet.length === 0 ? (
                <tr className={satirR}><td className="px-3 py-3" colSpan={3}>Veri yok</td></tr>
              ) : ozet.map((o, i) => (
                <tr key={i} className={satirR}>
                  <td className="px-3 py-1.5">{o.kullanici_adi}</td>
                  <td className="px-3 py-1.5">{NIYET_ETIKET[o.niyet] ?? o.niyet}</td>
                  <td className="px-3 py-1.5 text-right">{o.adet}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className={baslik}>Son Sorular</h3>
        <div className={birlesik(kutu, 'max-h-56 overflow-y-auto')}>
          <table className="w-full text-sm">
            <tbody>
              {sorgular.length === 0 ? (
                <tr className={satirR}><td className="px-3 py-3">Henüz soru yok</td></tr>
              ) : sorgular.map((s, i) => (
                <tr key={i} className={satirR}>
                  <td className="px-3 py-1.5 whitespace-nowrap text-xs opacity-70">{s.kullanici_adi}</td>
                  <td className="px-3 py-1.5">{s.soru_metni}</td>
                  <td className="px-3 py-1.5 text-xs whitespace-nowrap opacity-70">{NIYET_ETIKET[s.niyet] ?? s.niyet}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className={baslik}>Güncel Stok</h3>
        <div className={birlesik(kutu, 'max-h-56 overflow-y-auto')}>
          <table className="w-full text-sm">
            <thead className={temaKoyuMu ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-100 text-neutral-500'}>
              <tr><th className="px-3 py-2 text-left">Ürün</th><th className="px-3 py-2 text-right">Stok</th><th className="px-3 py-2 text-right">Kritik</th></tr>
            </thead>
            <tbody>
              {stok.map((s, i) => (
                <tr key={i} className={satirR}>
                  <td className="px-3 py-1.5">{s.urun_adi}</td>
                  <td className={birlesik('px-3 py-1.5 text-right', s.kritik_seviye > 0 && s.mevcut_stok <= s.kritik_seviye ? 'text-red-500 font-semibold' : '')}>{s.mevcut_stok}</td>
                  <td className="px-3 py-1.5 text-right opacity-70">{s.kritik_seviye}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
