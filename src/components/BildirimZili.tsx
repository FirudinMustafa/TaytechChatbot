import { useEffect, useState, useRef } from 'react';
import { birlesik } from '../utils/cn';
import { temaKullan } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import { bildirimleriGetir, bildirimOkunduIsaretle } from '../services/veriServis';
import { Bildirim } from '../types';
import { saatFormatla } from '../utils/formatDate';

export default function BildirimZili() {
  const { temaKoyuMu } = temaKullan();
  const [bildirimler, bildirimlerAyarla] = useState<Bildirim[]>([]);
  const [acik, acikAyarla] = useState(false);
  const kutuRef = useRef<HTMLDivElement>(null);

  const okunmamis = bildirimler.filter((b) => !b.okundu).length;

  const yenile = () => bildirimleriGetir().then(bildirimlerAyarla);

  useEffect(() => {
    yenile();
    // Realtime: yeni bildirimde listeyi tazele
    const kanal = supabase
      .channel('bildirim-kanal')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bildirimler' }, () => {
        yenile();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(kanal);
    };
  }, []);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    const isle = (e: MouseEvent) => {
      if (kutuRef.current && !kutuRef.current.contains(e.target as Node)) acikAyarla(false);
    };
    document.addEventListener('mousedown', isle);
    return () => document.removeEventListener('mousedown', isle);
  }, []);

  const okunduIsle = async (b: Bildirim) => {
    if (!b.okundu) {
      await bildirimOkunduIsaretle(b.id);
      bildirimlerAyarla((onceki) =>
        onceki.map((x) => (x.id === b.id ? { ...x, okundu: true } : x)),
      );
    }
  };

  return (
    <div className="relative" ref={kutuRef}>
      <button
        onClick={() => acikAyarla((a) => !a)}
        className={birlesik(
          'relative p-2 rounded-lg transition-colors',
          temaKoyuMu
            ? 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
            : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800',
        )}
        title="Bildirimler"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {okunmamis > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
            {okunmamis > 9 ? '9+' : okunmamis}
          </span>
        )}
      </button>

      {acik && (
        <div
          className={birlesik(
            'absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl shadow-2xl z-50 border',
            temaKoyuMu ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200',
          )}
        >
          <div className={birlesik('px-4 py-3 text-sm font-medium border-b sticky top-0', temaKoyuMu ? 'text-neutral-200 border-neutral-800 bg-neutral-900' : 'text-neutral-800 border-neutral-100 bg-white')}>
            Bildirimler
          </div>
          {bildirimler.length === 0 ? (
            <p className={birlesik('px-4 py-8 text-center text-sm', temaKoyuMu ? 'text-neutral-500' : 'text-neutral-400')}>
              Bildirim yok
            </p>
          ) : (
            bildirimler.map((b) => (
              <button
                key={b.id}
                onClick={() => okunduIsle(b)}
                className={birlesik(
                  'w-full text-left px-4 py-3 border-b transition-colors',
                  temaKoyuMu ? 'border-neutral-800 hover:bg-neutral-800/50' : 'border-neutral-100 hover:bg-neutral-50',
                  !b.okundu && (temaKoyuMu ? 'bg-neutral-800/30' : 'bg-blue-50/50'),
                )}
              >
                <div className="flex items-start gap-2">
                  {!b.okundu && <span className="mt-1.5 w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className={birlesik('text-sm font-medium truncate', temaKoyuMu ? 'text-neutral-200' : 'text-neutral-800')}>
                      {b.baslik}
                    </p>
                    {b.icerik && (
                      <p className={birlesik('text-xs mt-0.5', temaKoyuMu ? 'text-neutral-400' : 'text-neutral-500')}>
                        {b.icerik}
                      </p>
                    )}
                    <p className={birlesik('text-[10px] mt-1', temaKoyuMu ? 'text-neutral-600' : 'text-neutral-400')}>
                      {saatFormatla(b.olusturmaTarihi)}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
