// ============================================================================
// ai-sorgu — Doğal dildeki soruyu güvenli RPC'ye çevirip cevaplayan Edge Function
//
// Akış:
//  1) Kullanıcı JWT'si ile Supabase client kur (RLS otomatik uygulanır).
//  2) Kullanıcının rolünü oku, role uygun araç kataloğunu hazırla.
//  3) Gemini'ye soru + araç şeması gönder → araç seçimi (function-calling).
//  4) Araç adını beyaz listeye karşı doğrula, RPC'yi çalıştır.
//  5) Sonucu tabloya çevir + Gemini ile kısa Türkçe özet üret.
//  6) sorgu_kayitlari'na niyet ile birlikte logla, cevabı döndür.
//
// GÜVENLİK: AI asla ham SQL üretmez; yalnızca önceden tanımlı RPC'leri
// parametreyle çağırır. Yetki kontrolü hem burada (beyaz liste) hem de
// veritabanında (RLS + RPC içi rol kontrolü) yapılır.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsBasliklari } from '../_shared/cors.ts';
import { saglayiciOlustur, type AracTanimi } from '../_shared/llm.ts';

interface AracKaydi {
  tanim: AracTanimi;
  roller: string[];   // bu aracı kullanabilecek roller
  niyet: string;      // sorgu_kayitlari için niyet etiketi
}

// --- Araç kataloğu (RPC'lerle birebir eşleşir) ---------------------------------
const ARAC_KATALOG: Record<string, AracKaydi> = {
  guncel_stok_listesi: {
    roller: ['mudur', 'depo', 'muhasebe', 'resepsiyon'],
    niyet: 'stok_sorgu',
    tanim: {
      name: 'guncel_stok_listesi',
      description: 'Ürünlerin güncel stok miktarlarını listeler. Belirli bir ürün için "arama" verilebilir.',
      parameters: {
        type: 'OBJECT',
        properties: {
          arama: { type: 'STRING', description: 'Ürün adı veya kodu filtresi (opsiyonel)' },
        },
      },
    },
  },
  dusuk_stok_listesi: {
    roller: ['mudur', 'depo', 'muhasebe'],
    niyet: 'stok_sorgu',
    tanim: {
      name: 'dusuk_stok_listesi',
      description: 'Kritik seviyenin altına düşmüş (azalan) ürünleri listeler.',
      parameters: { type: 'OBJECT', properties: {} },
    },
  },
  en_cok_giden_urunler: {
    roller: ['mudur', 'depo', 'muhasebe'],
    niyet: 'satis_analiz',
    tanim: {
      name: 'en_cok_giden_urunler',
      description: 'Bir tarih aralığında en çok satılan/çıkış yapan ürünleri sıralar. Tarih verilmezse son 30 gün.',
      parameters: {
        type: 'OBJECT',
        properties: {
          baslangic: { type: 'STRING', description: 'Başlangıç tarihi YYYY-MM-DD (opsiyonel)' },
          bitis: { type: 'STRING', description: 'Bitiş tarihi YYYY-MM-DD (opsiyonel)' },
          adet: { type: 'INTEGER', description: 'Kaç ürün listelensin (varsayılan 10)' },
        },
      },
    },
  },
  donem_kar_zarar: {
    roller: ['mudur', 'muhasebe'],
    niyet: 'muhasebe_sorgu',
    tanim: {
      name: 'donem_kar_zarar',
      description: 'Bir dönemdeki toplam gelir, gider ve net kâr/zararı verir. "Bu ay ne kazandım/harcadım/kâr" gibi sorular için. Tarih verilmezse içinde bulunulan ay.',
      parameters: {
        type: 'OBJECT',
        properties: {
          baslangic: { type: 'STRING', description: 'Başlangıç tarihi YYYY-MM-DD (opsiyonel)' },
          bitis: { type: 'STRING', description: 'Bitiş tarihi YYYY-MM-DD (opsiyonel)' },
        },
      },
    },
  },
  gider_dokumu: {
    roller: ['mudur', 'muhasebe'],
    niyet: 'muhasebe_sorgu',
    tanim: {
      name: 'gider_dokumu',
      description: 'Giderleri kategoriye göre döker. Tarih verilmezse içinde bulunulan ay.',
      parameters: {
        type: 'OBJECT',
        properties: {
          baslangic: { type: 'STRING', description: 'Başlangıç tarihi YYYY-MM-DD (opsiyonel)' },
          bitis: { type: 'STRING', description: 'Bitiş tarihi YYYY-MM-DD (opsiyonel)' },
          kategori_filtre: { type: 'STRING', description: 'Kategori filtresi (opsiyonel)' },
        },
      },
    },
  },
};

// Sütun başlıklarını kullanıcı dostu Türkçeye çevir
const BASLIK_ESLEME: Record<string, string> = {
  urun_kodu: 'Ürün Kodu', urun_adi: 'Ürün Adı', kategori: 'Kategori',
  mevcut_stok: 'Mevcut Stok', kritik_seviye: 'Kritik Seviye', durum: 'Durum',
  toplam_cikis: 'Toplam Çıkış', toplam_gelir: 'Toplam Gelir',
  toplam_gider: 'Toplam Gider', net: 'Net', donem_baslangic: 'Dönem Başı',
  donem_bitis: 'Dönem Sonu', kayit_sayisi: 'Kayıt Sayısı',
};

function tabloyaCevir(satirlar: Record<string, unknown>[]) {
  if (!Array.isArray(satirlar) || satirlar.length === 0) return undefined;
  const anahtarlar = Object.keys(satirlar[0]);
  return {
    sutunAdlari: anahtarlar.map((a) => BASLIK_ESLEME[a] ?? a),
    satirlar: satirlar.map((s) => anahtarlar.map((a) => (s[a] ?? null) as string | number | null)),
  };
}

function bugununTarihi(): string {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsBasliklari });
  }

  const baslangicZamani = Date.now();
  const jsonYanit = (govde: unknown, durum = 200) =>
    new Response(JSON.stringify(govde), {
      status: durum,
      headers: { ...corsBasliklari, 'Content-Type': 'application/json' },
    });

  try {
    const yetkiBasligi = req.headers.get('Authorization') ?? '';
    if (!yetkiBasligi) return jsonYanit({ hata: 'Yetkilendirme yok' }, 401);

    const { soru, oturumId } = await req.json();
    if (!soru || typeof soru !== 'string') {
      return jsonYanit({ hata: 'Soru gerekli' }, 400);
    }

    // Kullanıcı JWT'si ile client → RLS otomatik uygulanır
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: yetkiBasligi } } },
    );

    const { data: kullaniciVeri } = await supabase.auth.getUser();
    const kullanici = kullaniciVeri?.user;
    if (!kullanici) return jsonYanit({ hata: 'Geçersiz oturum' }, 401);

    const { data: profil } = await supabase
      .from('profiller')
      .select('rol, kullanici_adi')
      .eq('id', kullanici.id)
      .single();
    const rol = profil?.rol ?? 'resepsiyon';

    // Role uygun araçlar
    const uygunAraclar = Object.values(ARAC_KATALOG)
      .filter((a) => a.roller.includes(rol))
      .map((a) => a.tanim);

    const sistemTalimat =
      `Sen Taytech şirketinin kurumsal veri asistanısın. Bugünün tarihi ${bugununTarihi()}. ` +
      `Kullanıcının rolü: ${rol}. Soruyu yanıtlamak için uygun aracı seç ve parametrelerini doldur. ` +
      `"Bu ay", "geçen hafta" gibi ifadeleri bugünün tarihine göre YYYY-MM-DD aralığına çevir. ` +
      `Veriyle ilgisi olmayan sohbet sorularında araç çağırmadan kısa ve kibar Türkçe cevap ver.`;

    const llm = saglayiciOlustur();
    const secim = await llm.aracSec(soru, sistemTalimat, uygunAraclar);

    let niyet = 'diger';
    let icerik = '';
    let icerikTuru: 'text' | 'table' | 'error' = 'text';
    let tabloVerisi: ReturnType<typeof tabloyaCevir> = undefined;
    let kullanilanArac: string | null = null;
    let basarili = true;

    if (secim.aracCagrisi && ARAC_KATALOG[secim.aracCagrisi.ad]) {
      const kayit = ARAC_KATALOG[secim.aracCagrisi.ad];
      kullanilanArac = secim.aracCagrisi.ad;
      niyet = kayit.niyet;

      // Rol beyaz liste kontrolü (savunma katmanı)
      if (!kayit.roller.includes(rol)) {
        icerik = 'Bu bilgiye erişim yetkiniz bulunmuyor.';
        icerikTuru = 'error';
        basarili = false;
      } else {
        const { data: rpcVeri, error: rpcHata } = await supabase.rpc(
          secim.aracCagrisi.ad,
          secim.aracCagrisi.parametreler,
        );

        if (rpcHata) {
          basarili = false;
          icerikTuru = 'error';
          icerik = rpcHata.message.includes('yetkisiz')
            ? 'Bu bilgiye erişim yetkiniz bulunmuyor.'
            : 'Veri sorgulanırken bir sorun oluştu.';
        } else {
          const satirlar = (rpcVeri ?? []) as Record<string, unknown>[];
          tabloVerisi = tabloyaCevir(satirlar);
          icerikTuru = tabloVerisi ? 'table' : 'text';

          // Kısa Türkçe özet üret
          const ozetIstem =
            `Kullanıcının sorusu: "${soru}"\n` +
            `Sorgu sonucu (JSON): ${JSON.stringify(satirlar).slice(0, 4000)}\n\n` +
            `Bu sonucu kullanıcıya kısa, net ve profesyonel Türkçe ile yanıtla. ` +
            `Rakamları okunaklı yaz. Tablo verisi ayrıca gösterileceği için tabloyu tekrar yazma, sadece özet/yorum ver. ` +
            `Sonuç boşsa kibarca veri bulunmadığını belirt.`;
          try {
            icerik = await llm.metinUret(ozetIstem);
          } catch {
            icerik = satirlar.length
              ? 'İşte sorgunuzun sonucu:'
              : 'Bu kriterlere uygun kayıt bulunamadı.';
          }
        }
      }
    } else {
      // Araç seçilmedi → düz metin cevap. Niyeti sınıflandır.
      icerik = secim.metin || 'Size nasıl yardımcı olabilirim?';
      try {
        const sinif = await llm.metinUret(
          `Aşağıdaki kullanıcı mesajını TEK kelimeyle sınıflandır. ` +
          `Seçenekler: sikayet, kisisel_kullanim, diger. Sadece kelimeyi yaz.\nMesaj: "${soru}"`,
        );
        const temiz = sinif.toLowerCase().replace(/[^a-z_]/g, '');
        if (['sikayet', 'kisisel_kullanim', 'diger'].includes(temiz)) niyet = temiz;
      } catch { /* sınıflandırma başarısızsa diger kalır */ }
    }

    // Müdür analitiği için logla (RLS: kullanici_id = auth.uid())
    await supabase.from('sorgu_kayitlari').insert({
      kullanici_id: kullanici.id,
      oturum_id: oturumId ?? null,
      soru_metni: soru,
      niyet,
      kullanilan_arac: kullanilanArac,
      basarili,
      gecikme_ms: Date.now() - baslangicZamani,
    });

    return jsonYanit({ icerik, icerikTuru, tabloVerisi, niyet });
  } catch (e) {
    return jsonYanit(
      { hata: 'Sunucu hatası', detay: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});
