-- ============================================================================
-- Taytech Kurumsal Veri Asistanı — Başlangıç Şeması (Faz 0/1)
-- Tablolar + RLS + Görünümler + RPC fonksiyonları + Trigger'lar
-- Türkçe isimlendirme, koddaki konvansiyona uygun.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiller (auth.users ile 1:1)
--    NOT: aktif_rol() fonksiyonu profiller'e baktığı için tablo ÖNCE gelmeli.
-- ----------------------------------------------------------------------------
create table if not exists public.profiller (
  id            uuid primary key references auth.users(id) on delete cascade,
  kullanici_adi text not null,
  rol           text not null default 'resepsiyon'
                check (rol in ('mudur','muhasebe','depo','resepsiyon')),
  departman     text,
  eposta        text,
  aktif         boolean not null default true,
  sirket_id     uuid,
  olusturma_tarihi timestamptz not null default now()
);

-- Yardımcı: Giriş yapan kullanıcının rolü
-- SECURITY DEFINER → profiller RLS'ini atlar, böylece RLS özyinelemesi olmaz.
create or replace function public.aktif_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.profiller where id = auth.uid();
$$;

alter table public.profiller enable row level security;

-- Herkes kendi profilini görür; müdür hepsini görür.
create policy profiller_self_select on public.profiller
  for select using (id = auth.uid() or public.aktif_rol() = 'mudur');

-- Kendi profilini güncelleyebilir (rol hariç tutmak için ayrıca müdür kontrolü).
create policy profiller_self_update on public.profiller
  for update using (id = auth.uid() or public.aktif_rol() = 'mudur');

-- Sadece müdür yeni profil ekleyebilir/yönetebilir (kullanıcı oluşturma trigger ile de olur).
create policy profiller_mudur_insert on public.profiller
  for insert with check (public.aktif_rol() = 'mudur' or id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. Yeni kullanıcı → otomatik profil
--    user_metadata içinden kullanici_adi / rol / departman alınır.
-- ----------------------------------------------------------------------------
create or replace function public.yeni_kullanici_isle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiller (id, kullanici_adi, rol, departman, eposta)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'kullanici_adi', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'rol', 'resepsiyon'),
    coalesce(new.raw_user_meta_data->>'departman', new.raw_user_meta_data->>'rol', 'resepsiyon'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.yeni_kullanici_isle();

-- ----------------------------------------------------------------------------
-- 3. urunler
-- ----------------------------------------------------------------------------
create table if not exists public.urunler (
  id            uuid primary key default gen_random_uuid(),
  urun_kodu     text not null unique,
  urun_adi      text not null,
  kategori      text,
  birim         text not null default 'adet',
  birim_fiyat   numeric(14,2) default 0,
  kritik_seviye integer not null default 0,
  aktif         boolean not null default true,
  sirket_id     uuid,
  olusturma_tarihi timestamptz not null default now()
);

alter table public.urunler enable row level security;

-- Tüm roller ürünleri okuyabilir (stok sorgusu için gerekli).
create policy urunler_select on public.urunler
  for select using (auth.uid() is not null);

-- Müdür ve depo ürün ekleyip güncelleyebilir.
create policy urunler_yaz on public.urunler
  for all using (public.aktif_rol() in ('mudur','depo'))
  with check (public.aktif_rol() in ('mudur','depo'));

-- ----------------------------------------------------------------------------
-- 4. stok_hareketleri (değişmez defter)
-- ----------------------------------------------------------------------------
create table if not exists public.stok_hareketleri (
  id           uuid primary key default gen_random_uuid(),
  urun_id      uuid not null references public.urunler(id) on delete cascade,
  hareket_turu text not null check (hareket_turu in ('giris','cikis','duzeltme')),
  miktar       integer not null,
  aciklama     text,
  kaynak       text not null default 'form' check (kaynak in ('form','excel','erp')),
  olusturan_id uuid references public.profiller(id),
  olusturma_tarihi timestamptz not null default now()
);

create index if not exists idx_stok_hareket_urun on public.stok_hareketleri(urun_id);
create index if not exists idx_stok_hareket_tarih on public.stok_hareketleri(olusturma_tarihi);

alter table public.stok_hareketleri enable row level security;

-- Tüm roller hareketleri okuyabilir (stok hesabı için).
create policy stok_select on public.stok_hareketleri
  for select using (auth.uid() is not null);

-- Müdür ve depo hareket girebilir.
create policy stok_yaz on public.stok_hareketleri
  for insert with check (public.aktif_rol() in ('mudur','depo'));

-- ----------------------------------------------------------------------------
-- 5. v_guncel_stok (defterden hesaplanan güncel stok)
-- ----------------------------------------------------------------------------
create or replace view public.v_guncel_stok
with (security_invoker = on) as
select
  u.id            as urun_id,
  u.urun_kodu,
  u.urun_adi,
  u.kategori,
  u.birim,
  u.kritik_seviye,
  coalesce(sum(
    case h.hareket_turu
      when 'giris' then h.miktar
      when 'cikis' then -h.miktar
      when 'duzeltme' then h.miktar
    end
  ), 0)::integer as mevcut_stok
from public.urunler u
left join public.stok_hareketleri h on h.urun_id = u.id
where u.aktif
group by u.id, u.urun_kodu, u.urun_adi, u.kategori, u.birim, u.kritik_seviye;

-- ----------------------------------------------------------------------------
-- 6. muhasebe_kayitlari
-- ----------------------------------------------------------------------------
create table if not exists public.muhasebe_kayitlari (
  id           uuid primary key default gen_random_uuid(),
  kayit_turu   text not null check (kayit_turu in ('gelir','gider')),
  tutar        numeric(14,2) not null,
  para_birimi  text not null default 'TRY',
  kategori     text,
  aciklama     text,
  belge_no     text,
  kayit_tarihi date not null default current_date,
  kaynak       text not null default 'form' check (kaynak in ('form','excel','erp')),
  olusturan_id uuid references public.profiller(id),
  olusturma_tarihi timestamptz not null default now()
);

create index if not exists idx_muhasebe_tarih on public.muhasebe_kayitlari(kayit_tarihi);

alter table public.muhasebe_kayitlari enable row level security;

-- Sadece müdür ve muhasebe okur/yazar. Depo & resepsiyon erişemez.
create policy muhasebe_select on public.muhasebe_kayitlari
  for select using (public.aktif_rol() in ('mudur','muhasebe'));

create policy muhasebe_yaz on public.muhasebe_kayitlari
  for all using (public.aktif_rol() in ('mudur','muhasebe'))
  with check (public.aktif_rol() in ('mudur','muhasebe'));

-- ----------------------------------------------------------------------------
-- 7. sohbet_oturumlari + mesajlar (localStorage yerine)
-- ----------------------------------------------------------------------------
create table if not exists public.sohbet_oturumlari (
  id            uuid primary key default gen_random_uuid(),
  kullanici_id  uuid not null references public.profiller(id) on delete cascade,
  baslik        text not null default 'Yeni Sohbet',
  olusturma_tarihi  timestamptz not null default now(),
  guncelleme_tarihi timestamptz not null default now()
);

alter table public.sohbet_oturumlari enable row level security;

create policy oturum_sahip on public.sohbet_oturumlari
  for all using (kullanici_id = auth.uid() or public.aktif_rol() = 'mudur')
  with check (kullanici_id = auth.uid());

create table if not exists public.mesajlar (
  id            uuid primary key default gen_random_uuid(),
  oturum_id     uuid not null references public.sohbet_oturumlari(id) on delete cascade,
  rol           text not null check (rol in ('user','assistant')),
  icerik        text not null default '',
  icerik_turu   text not null default 'text',
  tablo_verisi  jsonb,
  zaman_damgasi timestamptz not null default now()
);

create index if not exists idx_mesaj_oturum on public.mesajlar(oturum_id);

alter table public.mesajlar enable row level security;

create policy mesaj_sahip on public.mesajlar
  for all using (
    exists (
      select 1 from public.sohbet_oturumlari o
      where o.id = mesajlar.oturum_id
        and (o.kullanici_id = auth.uid() or public.aktif_rol() = 'mudur')
    )
  )
  with check (
    exists (
      select 1 from public.sohbet_oturumlari o
      where o.id = mesajlar.oturum_id and o.kullanici_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 8. sorgu_kayitlari (müdür analitiği — niyet takibi)
-- ----------------------------------------------------------------------------
create table if not exists public.sorgu_kayitlari (
  id             uuid primary key default gen_random_uuid(),
  kullanici_id   uuid not null references public.profiller(id) on delete cascade,
  oturum_id      uuid references public.sohbet_oturumlari(id) on delete set null,
  soru_metni     text not null,
  niyet          text default 'diger'
                 check (niyet in ('stok_sorgu','muhasebe_sorgu','satis_analiz','sikayet','kisisel_kullanim','diger')),
  niyet_guven    numeric(3,2),
  kullanilan_arac text,
  basarili       boolean not null default true,
  gecikme_ms     integer,
  olusturma_tarihi timestamptz not null default now()
);

create index if not exists idx_sorgu_kullanici on public.sorgu_kayitlari(kullanici_id);
create index if not exists idx_sorgu_tarih on public.sorgu_kayitlari(olusturma_tarihi);

alter table public.sorgu_kayitlari enable row level security;

-- Kullanıcı kendi kayıtlarını görür; müdür HEPSİNİ görür.
create policy sorgu_select on public.sorgu_kayitlari
  for select using (kullanici_id = auth.uid() or public.aktif_rol() = 'mudur');

create policy sorgu_insert on public.sorgu_kayitlari
  for insert with check (kullanici_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 9. bildirimler
-- ----------------------------------------------------------------------------
create table if not exists public.bildirimler (
  id              uuid primary key default gen_random_uuid(),
  alici_id        uuid references public.profiller(id) on delete cascade,
  hedef_rol       text check (hedef_rol in ('mudur','muhasebe','depo','resepsiyon')),
  tur             text not null default 'sistem' check (tur in ('dusuk_stok','sistem','rapor')),
  baslik          text not null,
  icerik          text,
  urun_id         uuid references public.urunler(id) on delete cascade,
  okundu          boolean not null default false,
  eposta_gonderildi boolean not null default false,
  olusturma_tarihi timestamptz not null default now()
);

create index if not exists idx_bildirim_alici on public.bildirimler(alici_id);
create index if not exists idx_bildirim_rol on public.bildirimler(hedef_rol);

alter table public.bildirimler enable row level security;

-- Kullanıcı kendisine veya rolüne ait bildirimleri görür; müdür hepsini görür.
create policy bildirim_select on public.bildirimler
  for select using (
    alici_id = auth.uid()
    or hedef_rol = public.aktif_rol()
    or public.aktif_rol() = 'mudur'
  );

-- Okundu işaretleme için update.
create policy bildirim_update on public.bildirimler
  for update using (
    alici_id = auth.uid()
    or hedef_rol = public.aktif_rol()
    or public.aktif_rol() = 'mudur'
  );

-- Realtime yayını
alter publication supabase_realtime add table public.bildirimler;

-- ----------------------------------------------------------------------------
-- 10. Düşük stok trigger: hareket eklendikten sonra stok eşiğin altına inerse
--     bildirim oluştur (tekrar engellemeli).
-- ----------------------------------------------------------------------------
create or replace function public.dusuk_stok_kontrol()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mevcut integer;
  v_kritik integer;
  v_ad text;
  v_kod text;
begin
  select gs.mevcut_stok, gs.kritik_seviye, gs.urun_adi, gs.urun_kodu
    into v_mevcut, v_kritik, v_ad, v_kod
  from public.v_guncel_stok gs
  where gs.urun_id = new.urun_id;

  if v_mevcut is not null and v_kritik > 0 and v_mevcut <= v_kritik then
    -- Aynı ürün için okunmamış düşük stok bildirimi yoksa ekle.
    if not exists (
      select 1 from public.bildirimler b
      where b.urun_id = new.urun_id and b.tur = 'dusuk_stok' and b.okundu = false
    ) then
      insert into public.bildirimler (hedef_rol, tur, baslik, icerik, urun_id)
      values (
        'depo',
        'dusuk_stok',
        'Düşük stok: ' || v_ad,
        v_kod || ' (' || v_ad || ') stok ' || v_mevcut || ' adete düştü. Kritik seviye: ' || v_kritik || '.',
        new.urun_id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dusuk_stok on public.stok_hareketleri;
create trigger trg_dusuk_stok
  after insert on public.stok_hareketleri
  for each row execute function public.dusuk_stok_kontrol();

-- ============================================================================
-- RPC FONKSİYONLARI (AI araç kataloğu)
-- Hepsi SECURITY INVOKER → çağıranın RLS'i geçerli. Hassas olanlarda ek rol
-- kontrolü ile yetkisiz erişimde açık hata verilir.
-- ============================================================================

-- 11.1 Güncel stok listesi (opsiyonel arama)
create or replace function public.guncel_stok_listesi(arama text default null)
returns table (
  urun_kodu text, urun_adi text, kategori text, mevcut_stok integer, kritik_seviye integer, durum text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    gs.urun_kodu, gs.urun_adi, gs.kategori, gs.mevcut_stok, gs.kritik_seviye,
    case
      when gs.kritik_seviye > 0 and gs.mevcut_stok <= gs.kritik_seviye then 'Kritik'
      when gs.kritik_seviye > 0 and gs.mevcut_stok <= gs.kritik_seviye * 1.5 then 'Uyarı'
      else 'Normal'
    end as durum
  from public.v_guncel_stok gs
  where arama is null
     or gs.urun_adi ilike '%' || arama || '%'
     or gs.urun_kodu ilike '%' || arama || '%'
  order by gs.mevcut_stok asc;
$$;

-- 11.2 Düşük stok listesi
create or replace function public.dusuk_stok_listesi()
returns table (urun_kodu text, urun_adi text, mevcut_stok integer, kritik_seviye integer)
language sql
stable
security invoker
set search_path = public
as $$
  select gs.urun_kodu, gs.urun_adi, gs.mevcut_stok, gs.kritik_seviye
  from public.v_guncel_stok gs
  where gs.kritik_seviye > 0 and gs.mevcut_stok <= gs.kritik_seviye
  order by gs.mevcut_stok asc;
$$;

-- 11.3 En çok giden ürünler (çıkış miktarına göre). Tarih boşsa son 30 gün.
create or replace function public.en_cok_giden_urunler(
  baslangic date default null, bitis date default null, adet integer default 10
)
returns table (urun_kodu text, urun_adi text, toplam_cikis bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select u.urun_kodu, u.urun_adi, sum(h.miktar)::bigint as toplam_cikis
  from public.stok_hareketleri h
  join public.urunler u on u.id = h.urun_id
  where h.hareket_turu = 'cikis'
    and h.olusturma_tarihi::date >= coalesce(baslangic, current_date - interval '30 days')
    and h.olusturma_tarihi::date <= coalesce(bitis, current_date)
  group by u.urun_kodu, u.urun_adi
  order by toplam_cikis desc
  limit greatest(coalesce(adet, 10), 1);
$$;

-- 11.4 Dönem kâr/zarar (gelir, gider, net). Tarih boşsa içinde bulunulan ay.
create or replace function public.donem_kar_zarar(
  baslangic date default null, bitis date default null
)
returns table (toplam_gelir numeric, toplam_gider numeric, net numeric, donem_baslangic date, donem_bitis date)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_bas date := coalesce(baslangic, date_trunc('month', current_date)::date);
  v_bit date := coalesce(bitis, (date_trunc('month', current_date) + interval '1 month - 1 day')::date);
begin
  if public.aktif_rol() not in ('mudur','muhasebe') then
    raise exception 'yetkisiz: muhasebe verisine erisim yok';
  end if;
  return query
  select
    coalesce(sum(tutar) filter (where kayit_turu = 'gelir'), 0),
    coalesce(sum(tutar) filter (where kayit_turu = 'gider'), 0),
    coalesce(sum(tutar) filter (where kayit_turu = 'gelir'), 0)
      - coalesce(sum(tutar) filter (where kayit_turu = 'gider'), 0),
    v_bas, v_bit
  from public.muhasebe_kayitlari
  where kayit_tarihi >= v_bas and kayit_tarihi <= v_bit;
end;
$$;

-- 11.5 Gider dökümü (kategoriye göre). Tarih boşsa içinde bulunulan ay.
create or replace function public.gider_dokumu(
  baslangic date default null, bitis date default null, kategori_filtre text default null
)
returns table (kategori text, toplam_gider numeric, kayit_sayisi bigint)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_bas date := coalesce(baslangic, date_trunc('month', current_date)::date);
  v_bit date := coalesce(bitis, (date_trunc('month', current_date) + interval '1 month - 1 day')::date);
begin
  if public.aktif_rol() not in ('mudur','muhasebe') then
    raise exception 'yetkisiz: muhasebe verisine erisim yok';
  end if;
  return query
  select coalesce(m.kategori, 'Diğer'), sum(m.tutar), count(*)::bigint
  from public.muhasebe_kayitlari m
  where m.kayit_turu = 'gider'
    and m.kayit_tarihi >= v_bas and m.kayit_tarihi <= v_bit
    and (kategori_filtre is null or m.kategori ilike '%' || kategori_filtre || '%')
  group by coalesce(m.kategori, 'Diğer')
  order by sum(m.tutar) desc;
end;
$$;

-- 11.6 Müdür kullanım özeti (niyet dağılımı + kullanıcı bazlı). Sadece müdür.
create or replace function public.mudur_kullanim_ozeti(gun integer default 30)
returns table (niyet text, kullanici_adi text, adet bigint)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if public.aktif_rol() <> 'mudur' then
    raise exception 'yetkisiz: sadece mudur erisebilir';
  end if;
  return query
  select sk.niyet, p.kullanici_adi, count(*)::bigint
  from public.sorgu_kayitlari sk
  join public.profiller p on p.id = sk.kullanici_id
  where sk.olusturma_tarihi >= now() - (greatest(coalesce(gun,30),1) || ' days')::interval
  group by sk.niyet, p.kullanici_adi
  order by count(*) desc;
end;
$$;

-- RPC'leri authenticated rolüne aç
grant execute on function public.guncel_stok_listesi(text) to authenticated;
grant execute on function public.dusuk_stok_listesi() to authenticated;
grant execute on function public.en_cok_giden_urunler(date, date, integer) to authenticated;
grant execute on function public.donem_kar_zarar(date, date) to authenticated;
grant execute on function public.gider_dokumu(date, date, text) to authenticated;
grant execute on function public.mudur_kullanim_ozeti(integer) to authenticated;
grant execute on function public.aktif_rol() to authenticated;
