# Kurulum Rehberi — Taytech Kurumsal Veri Asistanı

Bu uygulama artık gerçek bir backend'e (Supabase) ve yapay zekaya (Google Gemini)
bağlanıyor. Çalıştırmak için aşağıdaki adımları **sırayla** uygulayın.

> Süre: ~20 dakika. Hepsi ücretsiz katmanlarla yapılabilir.

---

## 1. Supabase projesi oluştur

1. https://supabase.com → giriş yap → **New project**.
2. Bir isim ve veritabanı şifresi belirle, bölge olarak **Frankfurt (eu-central)** seç (Türkiye'ye yakın).
3. Proje açıldıktan sonra **Project Settings → API** sayfasından şunları kopyala:
   - `Project URL`  → `VITE_SUPABASE_URL`
   - `anon public` anahtarı → `VITE_SUPABASE_ANON_KEY`

## 2. Veritabanı şemasını kur

**Dashboard SQL Editor ile (en kolay):**
1. Supabase panelinde **SQL Editor → New query**.
2. `supabase/migrations/0001_baslangic_sema.sql` dosyasının **tamamını** yapıştır → **Run**.
3. (Opsiyonel, test verisi) `supabase/seed.sql` içeriğini yapıştır → **Run**.

> CLI tercih ederseniz: `supabase link --project-ref <ref>` ardından `supabase db push`.

## 3. `.env` dosyasını doldur

Proje kökünde `.env.example`'ı `.env` olarak kopyala ve değerleri yapıştır:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## 4. Gemini API anahtarı al (ücretsiz)

1. https://aistudio.google.com/app/apikey → **Create API key**.
2. Anahtarı kopyala (frontend'e KOYMA — sadece Supabase'e secret olarak girilecek).

## 5. Edge Function'ları yayınla

Supabase CLI gerekir (https://supabase.com/docs/guides/cli — Docker gerekmez):

```powershell
supabase login
supabase link --project-ref <PROJE_REF>

# Gemini anahtarını secret olarak ekle
supabase secrets set GEMINI_API_KEY=AIza...senin-anahtarin

# AI sorgu fonksiyonunu yayınla
supabase functions deploy ai-sorgu
```

> `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` Supabase
> tarafından otomatik sağlanır; ayrıca eklemene gerek yok.

(Opsiyonel — e-posta bildirimi, Faz 3) Resend anahtarı alıp:
```powershell
supabase secrets set RESEND_API_KEY=re_... GONDEREN_EPOSTA="Taytech <bildirim@alaniniz.com>"
supabase functions deploy bildirim-eposta
```

## 6. Kullanıcıları oluştur

Giriş = **kullanıcı adı + 6 haneli PIN**. Arka planda kullanıcı adı
`kullaniciadi@taytech.local` e-postasına, PIN ise şifreye karşılık gelir.

**Dashboard → Authentication → Users → Add user:**
- Müdür için: `Email = mudur@taytech.local`, `Password = 123456`, **Auto Confirm User** işaretli.
- Depo için: `Email = depo@taytech.local`, `Password = 654321`, Auto Confirm.

Ardından **SQL Editor**'de rolleri ata (trigger profili `resepsiyon` olarak oluşturur):

```sql
update public.profiller set rol = 'mudur', kullanici_adi = 'mudur' where eposta = 'mudur@taytech.local';
update public.profiller set rol = 'depo',  kullanici_adi = 'depo'  where eposta = 'depo@taytech.local';
```

> Roller: `mudur`, `muhasebe`, `depo`, `resepsiyon`.

## 7. Uygulamayı çalıştır

```powershell
npm install
npm run dev
```

http://localhost:3000 → kullanıcı adı `mudur`, PIN `123456` ile giriş yap.

---

## Test senaryosu (uçtan uca doğrulama)

1. **Müdür** ile gir. Sağ üstte **Araçlar** ve **çan** ikonu görünür.
2. **Araçlar → Stok Hareketi**: bir üründen `çıkış` gir (örn. seed verisindeki
   `EL-GW1` için 14 adet çıkış → kritik seviyeye iner) → **çan**'da düşük stok bildirimi belirir.
3. Sohbete yaz: **"en çok giden ürün nedir?"** → gerçek veriden tablo döner.
4. Sohbete yaz: **"bu ay ne kazandım?"** → gelir/gider/net döner (seed verisi).
5. **Araçlar → Müdür Paneli**: tüm kullanıcıların soruları + niyet dağılımı + güncel stok görünür.
6. **Yetki testi:** `depo` ile gir, **"bu ay kâr ne kadar?"** sor → "erişim yetkiniz yok" yanıtı (RLS çalışıyor).

---

## Sık sorunlar

- **"Üzgünüm, şu anda yanıt veremiyorum"** → `ai-sorgu` deploy edilmemiş ya da `GEMINI_API_KEY` eksik. `supabase functions logs ai-sorgu` ile bak.
- **Giriş olmuyor** → kullanıcı `Auto Confirm` ile oluşturulmamış olabilir; ya da PIN 6 haneli değil (Supabase min. 6 karakter şifre ister).
- **Boş ekran / "VITE_SUPABASE_URL tanımlı değil"** → `.env` dosyası eksik veya `npm run dev` yeniden başlatılmadı.
- **Çan'da bildirim gelmiyor** → ürünün `kritik_seviye > 0` olmalı ve stok o seviyenin altına inmeli.

## Mimari

Detaylı plan ve fazlar için: bu repodaki plan dokümanı (`.claude/plans/...md`) ve aşağıdaki özet.

```
React (Vite)  ──>  Supabase
                    ├─ Auth (rol: mudur/muhasebe/depo/resepsiyon)
                    ├─ Postgres + RLS (rol bazlı erişim)
                    ├─ Realtime (bildirim çanı)
                    └─ Edge Function ai-sorgu ─> Gemini ─> güvenli RPC ─> Postgres
```

AI asla ham SQL üretmez; yalnızca önceden tanımlı güvenli fonksiyonları (RPC)
parametreyle çağırır. Yetki hem beyaz listede hem veritabanında (RLS) zorlanır.

---

## Genişletilmiş yetenekler (v2)

Canlı projede (`afeizyfojuruzhxjkukc`) aşağıdakiler **kurulu ve test edilmiştir**:

**Yeni veri alanları (tablolar):** müşteriler, teklifler, siparişler, cari hareketler,
tedarikçiler, satın alma, cihazlar (kurulum/garanti), servis kayıtları, BLES ölçümleri,
personel, izinler, görevler. Hepsi rol bazlı RLS ile korunur.

**AI'nın cevaplayabildiği yeni sorular (22 araç):**
- Satış/teklif: "açık teklifler", "teklif dönüşüm oranı", "bir sipariş nerede", "bekleyen sevkiyatlar"
- Cari/tahsilat (müdür+muhasebe): "vadesi geçen alacaklar kim", "müşteri bakiyeleri"
- Tedarik (müdür+depo): "ne sipariş etmeliyim" → önerilen satın alma miktarları
- Cihaz/servis: "garantisi bitenler", "açık arızalar", "servis özeti", cihaz arama
- BLES: "alarm veren sayaçlar", "site enerji tüketimi"
- İK (müdür+muhasebe): "kim izinli", "izin bakiyeleri"
- Görev: "açık görevler"
- Tahmin: "hangi ürün ne zaman tükenir" (90 günlük satış hızına göre)

**Veri girişi:** Sağ üstteki **Araçlar** panelinde role göre sekmeler (müşteri, teklif,
sipariş, cari, tedarikçi, satın alma, cihaz, servis, BLES, personel, izin, görev).

**Dışa aktarım:** Her sohbet tablosunda **Excel** ve **PDF** indirme butonları.

**Fatura OCR:** Araçlar → Muhasebe Kaydı → "Fatura/fiş fotoğrafı yükle" → Gemini görselden
alanları okuyup formu otomatik doldurur (`fatura-oku` edge function).

**Otomatik günlük rapor:** `pg_cron` her gün 06:00 (UTC) müdüre özet bildirim bırakır
(kritik stok, açık servis, vadesi geçen alacak, bu ay net, yakında tükenecek ürünler).
Fonksiyon: `public.gunluk_mudur_raporu()`; iş: `cron.job` → `gunluk-mudur-raporu`.

> **AI modeli notu:** Bu Google projesinde `gemini-2.0-flash` ücretsiz kotası kapalı
> olduğundan **`gemini-2.5-flash`** kullanılıyor (ücretsiz katman ~5 istek/dk; her soru 2
> çağrı). Yoğun kullanım için Gemini anahtarını ücretli bir projeyle değiştirin.

> **Şema kaynağı:** Tüm tablolar/RPC'ler canlı projeye uygulandı. Migration dosyalarını
> repoya dökmek için: `supabase db pull` (yeni bir `supabase/migrations/*.sql` üretir).
