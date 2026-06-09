-- ============================================================================
-- Örnek veri (test için). RLS'i atlayarak (service role / db reset) çalışır.
-- Auth kullanıcıları buradan oluşturulmaz; KURULUM.md'deki adımla ekleyin.
-- Gerçek Taytech kataloğu (taytech.com.tr).
-- ============================================================================

insert into public.urunler (urun_kodu, urun_adi, kategori, birim, birim_fiyat, kritik_seviye) values
  ('SH-IND','SmartHexa Indirect Isı İstasyonu','Isı İstasyonu','adet',18000,15),
  ('SH-DIR','SmartHexa Direct Isı İstasyonu','Isı İstasyonu','adet',16500,15),
  ('HH-IND','HydroHexa Indirect Isı İstasyonu','Isı İstasyonu','adet',15000,12),
  ('HH-DIR','HydroHexa Direct Isı İstasyonu','Isı İstasyonu','adet',14000,12),
  ('TH-IND','ThermoHexa Indirect Isı İstasyonu','Isı İstasyonu','adet',13500,10),
  ('TH-DIR','ThermoHexa Direct Isı İstasyonu','Isı İstasyonu','adet',12500,10),
  ('HEM-IND','Hydro EM Indirect Isı İstasyonu','Isı İstasyonu','adet',11000,8),
  ('HEM-DIR','Hydro EM Direct Isı İstasyonu','Isı İstasyonu','adet',10500,8),
  ('IRONTRAP','IRONTRAP Manyetik Filtre','Manyetik Filtre','adet',1500,20),
  ('IRONINOX','IRONINOX Manyetik Filtre','Manyetik Filtre','adet',2200,15),
  ('SMART-PNL','Smart Serisi Motor Kontrol Panosu','Kontrol Panosu','adet',9500,10),
  ('FINV-PNL','Frekans İnvertör Panosu','Kontrol Panosu','adet',12000,8),
  ('SOFT-PNL','Soft Starter Panosu','Kontrol Panosu','adet',8500,8),
  ('EMEK-PNL','Elektro Mekanik Panel','Kontrol Panosu','adet',6000,8),
  ('FIRE-NFPA','Yangın Pompa Panosu (NFPA/UL&FM)','Kontrol Panosu','adet',22000,5),
  ('FIRE-EN','Yangın Pompa Panosu (EN Serisi)','Kontrol Panosu','adet',19000,5),
  ('BLES-SW','BLES Yazılım Platformu Lisansı','BLES','lisans',6000,0),
  ('BLES-DL','BLES Veri Yönetim Cihazı (Datalogger)','BLES','adet',3200,10),
  ('KAL-IS','Isıtma Kalorimetresi','Sayaç','adet',1800,25),
  ('KAL-SG','Soğutma Kalorimetresi','Sayaç','adet',1900,20),
  ('SU-SAY','Su Sayacı','Sayaç','adet',650,40),
  ('SAYAC-IST','Sayaç İstasyonu','Sayaç','adet',4200,12)
on conflict (urun_kodu) do nothing;

-- Başlangıç stoğu
insert into public.stok_hareketleri (urun_id, hareket_turu, miktar, aciklama, kaynak)
select id, 'giris', 60, 'Başlangıç stoğu', 'form' from public.urunler;

-- Satış (çıkış) — en çok gidenler + kritik düşüşler
insert into public.stok_hareketleri (urun_id, hareket_turu, miktar, aciklama, kaynak)
select id, 'cikis', 48, 'Satış', 'form' from public.urunler where urun_kodu='IRONTRAP';
insert into public.stok_hareketleri (urun_id, hareket_turu, miktar, aciklama, kaynak)
select id, 'cikis', 50, 'Satış', 'form' from public.urunler where urun_kodu='IRONINOX';
insert into public.stok_hareketleri (urun_id, hareket_turu, miktar, aciklama, kaynak)
select id, 'cikis', 47, 'Proje sevkiyatı', 'form' from public.urunler where urun_kodu='SH-IND';
insert into public.stok_hareketleri (urun_id, hareket_turu, miktar, aciklama, kaynak)
select id, 'cikis', 30, 'Satış', 'form' from public.urunler where urun_kodu='HH-IND';
insert into public.stok_hareketleri (urun_id, hareket_turu, miktar, aciklama, kaynak)
select id, 'cikis', 25, 'Satış', 'form' from public.urunler where urun_kodu='KAL-IS';

-- Muhasebe (bu ay)
insert into public.muhasebe_kayitlari (kayit_turu, tutar, kategori, aciklama, kayit_tarihi) values
  ('gelir', 1860000, 'satis',   'SmartHexa satışları', date_trunc('month', current_date)::date + 2),
  ('gelir', 430500,  'satis',   'IRONTRAP satışları',  date_trunc('month', current_date)::date + 5),
  ('gider', 320000,  'tedarik', 'Hammadde alımı',      date_trunc('month', current_date)::date + 3),
  ('gider', 185000,  'maas',    'Personel maaşları',   date_trunc('month', current_date)::date + 1),
  ('gider', 45000,   'kira',    'Fabrika kirası',      date_trunc('month', current_date)::date + 1);

-- NOT: Müşteri/teklif/sipariş/cari/cihaz/servis/BLES/personel/izin/görev örnek
-- verileri için KURULUM.md'deki "örnek genişleme verisi" bölümüne bakın.
