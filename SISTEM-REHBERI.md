# Taytech Veri Asistanı — Sistem & Rol Rehberi

> Sistemin tamamı: 3 ana parça, Araçlar, Bildirim ve tüm roller için kim ne yapabilir/yapamaz.

## Giriş bilgileri
| Rol | Kullanıcı adı | PIN |
|---|---|---|
| 👑 Müdür | `mudur` | `123456` |
| 💼 Muhasebe | `muhasebe` | `111111` |
| 📦 Depo | `depo` | `654321` |
| 🛎️ Resepsiyon | `resepsiyon` | `222222` |

- Yerel: `npm run dev` → http://localhost:3000
- Canlı: https://taytech-chatbot-3xro.vercel.app

---

## 🧭 Sistemin 3 ana parçası
Herkes aynı ekrana girer, rolüne göre farklı şey görür.

| Parça | Ne işe yarar | Yön |
|---|---|---|
| 💬 **Sohbet** | Veriyi **sorgulamak** ("ne kadar?", "kim?", "hangi?") | Veri okuma |
| 🧰 **Araçlar** (sağ üst buton) | Veriyi **girmek/eklemek** (formlar) | Veri yazma |
| 🔔 **Bildirim / Notify** (sağ üst çan) | **Otomatik uyarı almak** | Sistem → kullanıcı |

---

## 🧰 ARAÇLAR nedir?
Sohbet veriyi *okur*; Araçlar veriyi *girer*. Panel, role göre değişen sekmeler (formlar) içerir.

| Sekme | Ne yapar | Roller |
|---|---|---|
| Stok Hareketi | Ürün seç → giriş/çıkış/düzeltme + miktar | Müdür, Depo |
| Ürün Ekle | Yeni ürün (kod, ad, kategori, fiyat, kritik seviye) | Müdür, Depo |
| Excel Yükle | Excel/CSV ile toplu stok hareketi | Müdür, Depo |
| Muhasebe Kaydı | Gelir/gider + 📷 Fatura OCR (foto → otomatik form) | Müdür, Muhasebe |
| Müşteri | Müşteri/firma kaydı | Müdür, Muhasebe, Resepsiyon |
| Teklif | Teklif (tutar, durum, geçerlilik) | Müdür, Muhasebe, Resepsiyon |
| Sipariş | Sipariş (tutar, durum, lokasyon TR/UK) | Müdür, Muhasebe, Depo, Resepsiyon |
| Cari Hareket | Borç/alacak (tahsilat takibi) | Müdür, Muhasebe |
| Tedarikçi | Tedarikçi firması | Müdür, Depo |
| Satın Alma | Satın alma siparişi/taslağı | Müdür, Depo |
| Cihaz | Kurulu cihaz (seri no, garanti, BLES) | Müdür, Depo |
| Servis Kaydı | Arıza/bakım/kurulum (öncelik, atanan) | Müdür, Depo |
| BLES Ölçüm | Saha sayaç verisi (enerji, sıcaklık) | Müdür, Depo |
| Personel | Çalışan kaydı (departman, izin hakkı) | Müdür, Muhasebe |
| İzin | İzin talebi/onayı | Müdür, Muhasebe |
| Görev | Görev/hatırlatma oluştur, ata | Tüm roller |
| Müdür Paneli | Kim ne sordu + niyet + kullanım + güncel stok | Sadece Müdür |

> Her rol sadece kendi yetkisindeki sekmeleri görür.

---

## 🔔 BİLDİRİM (Notify) ne işe yarar?
Sağ üstteki çan. Sistem önemli olayları otomatik buraya düşürür. Okunmamışlar kırmızı rozetle sayılır.

| Tür | Ne zaman | Kim görür |
|---|---|---|
| 🔴 Düşük stok | Stok kritik seviyenin altına inince (anında) | Depo + Müdür |
| 🌅 Günlük rapor | Her sabah 06:00 (kritik stok, açık servis, vadesi geçen alacak, bu ay net) | Müdür |
| ⚙️ Sistem | Genel uyarılar | İlgili rol |

Anlık (Realtime) çalışır; e-posta bildirimi de altyapıda hazır (istenirse açılır).

---

## 👥 Roller — özet

### 👑 Müdür
Tüm şirketi yönetir + ekibi izler. **Sınırsız.** Tek özel: Müdür Paneli + günlük rapor. Tüm Araçlar sekmeleri.

### 💼 Muhasebe
Para + İK. Gelir-gider, kâr-zarar, cari/tahsilat, teklif/sipariş, personel/izin. Fatura OCR. Stoğu sadece **görür**.
**Yapamaz:** stok girişi, tedarik, cihaz/servis/BLES, Müdür Paneli.

### 📦 Depo
Ürün, stok, saha. Stok giriş/çıkış, ürün, Excel, tedarik önerisi, cihaz/garanti, servis, BLES, tahmin.
**Yapamaz:** muhasebe/kâr-zarar/cari, personel/izin, Müdür Paneli.

### 🛎️ Resepsiyon
Ön ofis. Teklif/sipariş/sevkiyat takibi, cihaz arama, stok okuma. Müşteri/teklif/sipariş girer.
**Yapamaz:** muhasebe/cari, stok girişi, tedarik, cihaz/servis/BLES, personel/izin, Müdür Paneli.

---

## 📊 Tam yetki matrisi
| Yetenek | 👑 Müdür | 💼 Muhasebe | 📦 Depo | 🛎️ Resepsiyon |
|---|:---:|:---:|:---:|:---:|
| Stok sorgu | ✅ | ✅ | ✅ | ✅ |
| Stok giriş | ✅ | ❌ | ✅ | ❌ |
| Ürün / Excel yükleme | ✅ | ❌ | ✅ | ❌ |
| Muhasebe & kâr-zarar | ✅ | ✅ | ❌ | ❌ |
| Cari / tahsilat | ✅ | ✅ | ❌ | ❌ |
| Fatura OCR | ✅ | ✅ | ❌ | ❌ |
| Müşteri / Teklif | ✅ | ✅ | ❌ | ✅ |
| Sipariş | ✅ | ✅ | ✅ | ✅ |
| Tedarikçi / Satın alma | ✅ | ❌ | ✅ | ❌ |
| Cihaz / Servis / BLES | ✅ | ❌ | ✅ | ❌ |
| Personel / İzin | ✅ | ✅ | ❌ | ❌ |
| Görev | ✅ | ✅ | ✅ | ✅ |
| 🔔 Düşük stok bildirimi | ✅ | ❌ | ✅ | ❌ |
| 🔔 Günlük rapor | ✅ | ❌ | ❌ | ❌ |
| 👁️ Müdür Paneli | ✅ | ❌ | ❌ | ❌ |
| Excel/PDF indir · tema · kendi sohbeti | ✅ | ✅ | ✅ | ✅ |

---

## 🔒 "Yapamaz" nasıl garanti ediliyor?
Yetkisiz istek → "erişim yetkiniz yok". İki kat koruma:
1. **Araç gösterilmez** — yetkisiz role o araç hiç sunulmaz.
2. **Veritabanı kilidi (RLS)** — yolu bulsa bile veritabanı boş döner.

Güvenlik yapay zekaya değil, veritabanının temeline gömülüdür.

---

## Rol bazlı ana sayfa örnek soruları
- 👑 Müdür: Kâr-zarar · En çok giden ürün · Vadesi geçen alacaklar · Kritik stok
- 💼 Muhasebe: Ne kazandık/harcadık · Gider dökümü · Vadesi geçen alacaklar · Kim izinli
- 📦 Depo: Stok durumu · Kritik ürünler · En çok giden · Ne sipariş etmeliyim
- 🛎️ Resepsiyon: Açık teklifler · Bekleyen sevkiyat · Sipariş durumu · Açık servisler
