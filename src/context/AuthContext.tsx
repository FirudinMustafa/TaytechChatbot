import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Kullanici, Rol } from '../types';
import { girisYapApi } from '../services/api';
import { supabase } from '../services/supabase';

interface GirisContextTipi {
  kullanici: Kullanici | null;
  girisYapildiMi: boolean;
  hazir: boolean; // oturum durumu yüklendi mi
  girisYap: (kullaniciAdi: string, sifre: string) => Promise<{ basarili: boolean; mesaj: string }>;
  cikisYap: () => void;
}

const GirisContext = createContext<GirisContextTipi | null>(null);

async function profilGetir(kullaniciId: string): Promise<Kullanici | null> {
  const { data } = await supabase
    .from('profiller')
    .select('id, kullanici_adi, rol, departman')
    .eq('id', kullaniciId)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    kullaniciAdi: data.kullanici_adi,
    rol: data.rol as Rol,
    departman: data.departman,
  };
}

export function GirisProvider({ children }: { children: ReactNode }) {
  const [kullanici, kullaniciAyarla] = useState<Kullanici | null>(null);
  const [hazir, hazirAyarla] = useState(false);

  useEffect(() => {
    // İlk yükleme: mevcut oturumu kontrol et
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        kullaniciAyarla(await profilGetir(data.session.user.id));
      }
      hazirAyarla(true);
    });

    // Oturum değişimlerini dinle (giriş / çıkış / token yenileme)
    const { data: dinleyici } = supabase.auth.onAuthStateChange(async (_olay, oturum) => {
      if (oturum?.user) {
        kullaniciAyarla(await profilGetir(oturum.user.id));
      } else {
        kullaniciAyarla(null);
      }
    });

    return () => dinleyici.subscription.unsubscribe();
  }, []);

  const girisYap = useCallback(async (kullaniciAdi: string, sifre: string) => {
    const sonuc = await girisYapApi(kullaniciAdi, sifre);
    // Başarılıysa onAuthStateChange dinleyicisi kullaniciyi otomatik ayarlar.
    return sonuc;
  }, []);

  const cikisYap = useCallback(() => {
    supabase.auth.signOut();
    kullaniciAyarla(null);
  }, []);

  return (
    <GirisContext.Provider
      value={{ kullanici, girisYapildiMi: !!kullanici, hazir, girisYap, cikisYap }}
    >
      {children}
    </GirisContext.Provider>
  );
}

export function girisKullan() {
  const context = useContext(GirisContext);
  if (!context) throw new Error('girisKullan GirisProvider icinde kullanilmali');
  return context;
}
