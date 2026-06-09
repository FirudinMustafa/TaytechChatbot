export type Rol = 'mudur' | 'muhasebe' | 'depo' | 'resepsiyon';

export interface Kullanici {
  id: string;
  kullaniciAdi: string;
  rol: Rol;
  departman?: string | null;
}

export type MesajIcerikTuru = 'text' | 'table' | 'error' | 'system';

export interface TabloVerisi {
  sutunAdlari: string[];
  satirlar: (string | number | null)[][];
}

export interface Mesaj {
  id: string;
  rol: 'user' | 'assistant';
  icerik: string;
  gosterilenIcerik?: string;
  streamingMi?: boolean;
  icerikTuru: MesajIcerikTuru;
  tabloVerisi?: TabloVerisi;
  zamanDamgasi: number;
}

export interface SohbetOturumu {
  id: string;
  baslik: string;
  mesajlar: Mesaj[];
  olusturmaTarihi: number;
  guncellemeTarihi: number;
}

export interface Bildirim {
  id: string;
  tur: 'dusuk_stok' | 'sistem' | 'rapor';
  baslik: string;
  icerik: string | null;
  okundu: boolean;
  olusturmaTarihi: number;
}
