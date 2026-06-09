import { useEffect, useState } from 'react';
import { birlesik } from '../utils/cn';
import { temaKullan } from '../context/ThemeContext';
import { genelEkle, SecenekOge } from '../services/veriServis';

export type AlanTip = 'text' | 'number' | 'date' | 'textarea' | 'select' | 'dinamikSelect';

export interface Alan {
  ad: string;
  etiket: string;
  tip: AlanTip;
  zorunlu?: boolean;
  secenekler?: SecenekOge[];
  kaynak?: () => Promise<SecenekOge[]>;
  varsayilan?: string;
  yer?: string; // placeholder
}

interface GenelKayitFormuProps {
  tablo: string;
  alanlar: Alan[];
  ekVeri?: Record<string, unknown>; // örn. { olusturan_id: kullaniciId }
}

export default function GenelKayitFormu({ tablo, alanlar, ekVeri }: GenelKayitFormuProps) {
  const { temaKoyuMu } = temaKullan();
  const [deger, degerAyarla] = useState<Record<string, string>>(() => {
    const ilk: Record<string, string> = {};
    alanlar.forEach((a) => (ilk[a.ad] = a.varsayilan ?? ''));
    return ilk;
  });
  const [dinamik, dinamikAyarla] = useState<Record<string, SecenekOge[]>>({});
  const [mesaj, mesajAyarla] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(null);
  const [yukleniyor, yukleniyorAyarla] = useState(false);

  useEffect(() => {
    alanlar.filter((a) => a.tip === 'dinamikSelect' && a.kaynak).forEach((a) => {
      a.kaynak!().then((s) => dinamikAyarla((o) => ({ ...o, [a.ad]: s })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gir = temaKoyuMu
    ? 'w-full px-3 py-2.5 rounded-lg text-sm border-2 outline-none bg-neutral-800 border-neutral-700 text-white focus:border-neutral-500 placeholder-neutral-500'
    : 'w-full px-3 py-2.5 rounded-lg text-sm border-2 outline-none bg-neutral-50 border-neutral-200 text-neutral-900 focus:border-neutral-400 placeholder-neutral-400';
  const etiketCls = birlesik('block text-xs font-medium mb-1.5 uppercase tracking-wide', temaKoyuMu ? 'text-neutral-400' : 'text-neutral-500');

  const gonder = async () => {
    for (const a of alanlar) {
      if (a.zorunlu && !deger[a.ad]) {
        mesajAyarla({ tip: 'hata', metin: `${a.etiket} zorunlu.` });
        return;
      }
    }
    const kayit: Record<string, unknown> = { ...ekVeri };
    for (const a of alanlar) {
      const v = deger[a.ad];
      if (v === '' || v === undefined) continue;
      kayit[a.ad] = a.tip === 'number' ? Number(v) : v;
    }
    yukleniyorAyarla(true);
    const sonuc = await genelEkle(tablo, kayit);
    yukleniyorAyarla(false);
    mesajAyarla({ tip: sonuc.basarili ? 'ok' : 'hata', metin: sonuc.mesaj });
    if (sonuc.basarili) {
      const sifir: Record<string, string> = {};
      alanlar.forEach((a) => (sifir[a.ad] = a.varsayilan ?? ''));
      degerAyarla(sifir);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {alanlar.map((a) => {
          const tamGenislik = a.tip === 'textarea';
          return (
            <div key={a.ad} className={tamGenislik ? 'col-span-2' : ''}>
              <label className={etiketCls}>{a.etiket}{a.zorunlu ? ' *' : ''}</label>
              {a.tip === 'textarea' ? (
                <textarea className={gir} rows={2} value={deger[a.ad]} placeholder={a.yer}
                  onChange={(e) => degerAyarla((o) => ({ ...o, [a.ad]: e.target.value }))} />
              ) : a.tip === 'select' || a.tip === 'dinamikSelect' ? (
                <select className={gir} value={deger[a.ad]}
                  onChange={(e) => degerAyarla((o) => ({ ...o, [a.ad]: e.target.value }))}>
                  <option value="">— seçin —</option>
                  {(a.tip === 'select' ? a.secenekler ?? [] : dinamik[a.ad] ?? []).map((s) => (
                    <option key={s.deger} value={s.deger}>{s.etiket}</option>
                  ))}
                </select>
              ) : (
                <input className={gir} type={a.tip === 'number' ? 'number' : a.tip === 'date' ? 'date' : 'text'}
                  value={deger[a.ad]} placeholder={a.yer}
                  onChange={(e) => degerAyarla((o) => ({ ...o, [a.ad]: e.target.value }))} />
              )}
            </div>
          );
        })}
      </div>
      <button onClick={gonder} disabled={yukleniyor}
        className={birlesik('w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
          temaKoyuMu ? 'bg-neutral-200 text-neutral-900 hover:bg-white' : 'bg-neutral-900 text-white hover:bg-neutral-800')}>
        {yukleniyor ? 'Kaydediliyor...' : 'Kaydet'}
      </button>
      {mesaj && <p className={birlesik('text-sm', mesaj.tip === 'ok' ? 'text-green-500' : 'text-red-500')}>{mesaj.metin}</p>}
    </div>
  );
}
