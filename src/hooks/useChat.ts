import { useState, useCallback, useEffect, useRef } from 'react';
import { SohbetOturumu, Mesaj } from '../types';
import { girisKullan } from '../context/AuthContext';
import {
  mesajGonderApi,
  oturumlariGetirApi,
  oturumOlusturApi,
  oturumBaslikGuncelleApi,
  oturumSilApi,
  tumOturumlariSilApi,
  mesajKaydetApi,
} from '../services/api';

function rastgeleIdOlustur(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function baslikUret(icerik: string): string {
  return icerik.slice(0, 40) + (icerik.length > 40 ? '...' : '');
}

export function sohbetKullan() {
  const { kullanici } = girisKullan();
  const [sohbetler, sohbetleriAyarla] = useState<SohbetOturumu[]>([]);
  const [suankiSohbetId, suankiIdAyarla] = useState<string | null>(null);
  const [yukleniyor, yukleniyorAyarla] = useState(false);
  const streamingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const suankiSohbet = sohbetler.find((s) => s.id === suankiSohbetId) || null;

  // Giriş yapan kullanıcının sohbetlerini DB'den yükle
  useEffect(() => {
    if (!kullanici) {
      sohbetleriAyarla([]);
      suankiIdAyarla(null);
      return;
    }
    let iptal = false;
    oturumlariGetirApi().then((veri) => {
      if (!iptal) sohbetleriAyarla(veri);
    });
    return () => {
      iptal = true;
    };
  }, [kullanici]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamingRef.current) clearInterval(streamingRef.current);
    };
  }, []);

  const yeniSohbetOlustur = useCallback(async () => {
    if (!kullanici) return null;
    const id = await oturumOlusturApi(kullanici.id, 'Yeni Sohbet');
    if (!id) return null;
    const yeniOturum: SohbetOturumu = {
      id,
      baslik: 'Yeni Sohbet',
      mesajlar: [],
      olusturmaTarihi: Date.now(),
      guncellemeTarihi: Date.now(),
    };
    sohbetleriAyarla((onceki) => [yeniOturum, ...onceki]);
    suankiIdAyarla(id);
    return id;
  }, [kullanici]);

  const sohbetSec = useCallback((id: string) => {
    suankiIdAyarla(id);
  }, []);

  const sohbetiSil = useCallback(
    (id: string) => {
      sohbetleriAyarla((onceki) => onceki.filter((s) => s.id !== id));
      if (suankiSohbetId === id) suankiIdAyarla(null);
      oturumSilApi(id);
    },
    [suankiSohbetId],
  );

  const tumSohbetleriSil = useCallback(() => {
    sohbetleriAyarla([]);
    suankiIdAyarla(null);
    if (kullanici) tumOturumlariSilApi(kullanici.id);
  }, [kullanici]);

  const streamingBaslat = useCallback((oturumId: string, mesajId: string, tamIcerik: string) => {
    const kelimeler = tamIcerik.split(' ');
    let index = 0;

    streamingRef.current = setInterval(() => {
      index++;

      if (index >= kelimeler.length + 9) {
        if (streamingRef.current) {
          clearInterval(streamingRef.current);
          streamingRef.current = null;
        }
        sohbetleriAyarla((onceki) =>
          onceki.map((s) => {
            if (s.id !== oturumId) return s;
            return {
              ...s,
              mesajlar: s.mesajlar.map((m) =>
                m.id !== mesajId
                  ? m
                  : { ...m, gosterilenIcerik: String(kelimeler.length + 9), streamingMi: false },
              ),
            };
          }),
        );
        return;
      }

      sohbetleriAyarla((onceki) =>
        onceki.map((s) => {
          if (s.id !== oturumId) return s;
          return {
            ...s,
            mesajlar: s.mesajlar.map((m) =>
              m.id !== mesajId ? m : { ...m, gosterilenIcerik: String(index) },
            ),
          };
        }),
      );
    }, 100);
  }, []);

  const mesajGonder = useCallback(
    async (icerik: string) => {
      if (!kullanici) return;

      let oturumId = suankiSohbetId;
      let yeniOturumMu = false;

      // Oturum yoksa DB'de oluştur
      if (!oturumId) {
        const baslik = baslikUret(icerik);
        const id = await oturumOlusturApi(kullanici.id, baslik);
        if (!id) return;
        oturumId = id;
        yeniOturumMu = true;
        const yeniOturum: SohbetOturumu = {
          id,
          baslik,
          mesajlar: [],
          olusturmaTarihi: Date.now(),
          guncellemeTarihi: Date.now(),
        };
        sohbetleriAyarla((onceki) => [yeniOturum, ...onceki]);
        suankiIdAyarla(id);
      }

      const mevcutOturum = sohbetler.find((s) => s.id === oturumId);
      const ilkMesajMi = yeniOturumMu || (mevcutOturum?.mesajlar.length ?? 0) === 0;

      const kullaniciMesaji: Mesaj = {
        id: rastgeleIdOlustur(),
        rol: 'user',
        icerik,
        icerikTuru: 'text',
        zamanDamgasi: Date.now(),
      };

      sohbetleriAyarla((onceki) =>
        onceki.map((s) => {
          if (s.id !== oturumId) return s;
          return {
            ...s,
            baslik: ilkMesajMi ? baslikUret(icerik) : s.baslik,
            mesajlar: [...s.mesajlar, kullaniciMesaji],
            guncellemeTarihi: Date.now(),
          };
        }),
      );

      // Kullanıcı mesajını ve (gerekiyorsa) başlığı kalıcılaştır
      mesajKaydetApi(oturumId, kullaniciMesaji);
      if (ilkMesajMi && !yeniOturumMu) oturumBaslikGuncelleApi(oturumId, baslikUret(icerik));

      yukleniyorAyarla(true);

      try {
        const cevap = await mesajGonderApi(icerik, oturumId);
        const dbId = await mesajKaydetApi(oturumId, cevap);
        const cevapDb: Mesaj = { ...cevap, id: dbId };

        const streamingMesaj: Mesaj = { ...cevapDb, gosterilenIcerik: '', streamingMi: true };
        sohbetleriAyarla((onceki) =>
          onceki.map((s) =>
            s.id !== oturumId
              ? s
              : { ...s, mesajlar: [...s.mesajlar, streamingMesaj], guncellemeTarihi: Date.now() },
          ),
        );
        yukleniyorAyarla(false);
        streamingBaslat(oturumId, cevapDb.id, cevap.icerik);
      } catch {
        const hataMesaji: Mesaj = {
          id: rastgeleIdOlustur(),
          rol: 'assistant',
          icerik: 'Bir hata oluştu. Lütfen tekrar deneyin.',
          icerikTuru: 'error',
          zamanDamgasi: Date.now(),
        };
        sohbetleriAyarla((onceki) =>
          onceki.map((s) =>
            s.id !== oturumId ? s : { ...s, mesajlar: [...s.mesajlar, hataMesaji] },
          ),
        );
        yukleniyorAyarla(false);
      }
    },
    [suankiSohbetId, sohbetler, kullanici, streamingBaslat],
  );

  return {
    sohbetler,
    suankiSohbet,
    suankiSohbetId,
    yukleniyor,
    yeniSohbetOlustur,
    sohbetSec,
    sohbetiSil,
    tumSohbetleriSil,
    mesajGonder,
  };
}
