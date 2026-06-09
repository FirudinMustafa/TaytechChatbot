import { useState, FormEvent, useRef, useEffect, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { girisKullan } from '../context/AuthContext';
import { kullaniciKontrolApi } from '../services/api';
import Bildirim from '../components/Toast';

export default function GirisSayfasi() {
  const [kullaniciAdi, kullaniciAdiAyarla] = useState('');
  const [adim, adimAyarla] = useState<'kullanici' | 'pin'>('kullanici');
  const [pin, pinAyarla] = useState<string[]>(['', '', '', '', '', '']);
  const [yukleniyor, yukleniyorAyarla] = useState(false);
  const [hata, hataAyarla] = useState<string | null>(null);
  const [basarili, basariliAyarla] = useState(false);
  const [hatali, hataliAyarla] = useState(false);
  const [kullaniciHatali, kullaniciHataliAyarla] = useState(false);
  const [odaklanmisGirdi, odaklanmisGirdiAyarla] = useState<string | null>(null);
  const [gecisYapiliyor, gecisYapiliyorAyarla] = useState(false);

  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { girisYap } = girisKullan();
  const yonlendir = useNavigate();

  // PIN tamamlandığında otomatik giriş
  useEffect(() => {
    const tamPin = pin.join('');
    if (tamPin.length === 6 && adim === 'pin' && !hatali) {
      girisKontrol(tamPin);
    }
  }, [pin]);

  const kullaniciAdiGonder = async (e: FormEvent) => {
    e.preventDefault();
    kullaniciHataliAyarla(false);

    if (!kullaniciAdi.trim()) {
      kullaniciHataliAyarla(true);
      return;
    }

    // Kullanıcı adını kontrol et
    yukleniyorAyarla(true);
    try {
      const sonuc = await kullaniciKontrolApi(kullaniciAdi.trim());
      
      if (!sonuc.gecerli) {
        kullaniciHataliAyarla(true);
        
        // 2 saniye sonra kırmızı çerçeveyi kaldır
        setTimeout(() => {
          kullaniciHataliAyarla(false);
        }, 2000);
        return;
      }

      // Kullanıcı geçerli, PIN adımına geç
      gecisYapiliyorAyarla(true);
      
      setTimeout(() => {
        adimAyarla('pin');
        gecisYapiliyorAyarla(false);
        setTimeout(() => {
          pinRefs.current[0]?.focus();
        }, 50);
      }, 250);
    } catch {
      kullaniciHataliAyarla(true);
    } finally {
      yukleniyorAyarla(false);
    }
  };

  const pinDegistir = (index: number, deger: string) => {
    // Sadece rakam kabul et
    if (deger && !/^\d$/.test(deger)) return;

    // Hatalı durumda yeni giriş yapılınca hata durumunu sıfırla
    if (hatali) {
      hataliAyarla(false);
    }

    const yeniPin = [...pin];
    yeniPin[index] = deger;
    pinAyarla(yeniPin);

    // Sonraki kutuya geç
    if (deger && index < 5) {
      pinRefs.current[index + 1]?.focus();
    }
  };

  const pinTusBasimi = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    // Backspace ile önceki kutuya dön
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
  };

  const pinYapistir = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const yapistirilan = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (yapistirilan) {
      if (hatali) {
        hataliAyarla(false);
      }
      const yeniPin = [...pin];
      for (let i = 0; i < yapistirilan.length && i < 6; i++) {
        yeniPin[i] = yapistirilan[i];
      }
      pinAyarla(yeniPin);
      // Son dolu kutuya odaklan
      const sonDoluIndex = Math.min(yapistirilan.length - 1, 5);
      pinRefs.current[sonDoluIndex]?.focus();
    }
  };

  const girisKontrol = async (sifre: string) => {
    yukleniyorAyarla(true);
    // Gerçek giriş (Supabase). Başarılıysa AuthContext oturum dinleyicisi
    // kullaniciyi ayarlar ve yönlendirme otomatik gerçekleşir.
    const sonuc = await girisYap(kullaniciAdi.trim(), sifre);
    yukleniyorAyarla(false);

    if (sonuc.basarili) {
      basariliAyarla(true);
    } else {
      hataliAyarla(true);
      setTimeout(() => {
        pinAyarla(['', '', '', '', '', '']);
        hataliAyarla(false);
        setTimeout(() => {
          pinRefs.current[0]?.focus();
        }, 50);
      }, 1000);
    }
  };

  const geriDon = () => {
    gecisYapiliyorAyarla(true);
    
    setTimeout(() => {
      adimAyarla('kullanici');
      pinAyarla(['', '', '', '', '', '']);
      hataAyarla(null);
      basariliAyarla(false);
      hataliAyarla(false);
      gecisYapiliyorAyarla(false);
    }, 250);
  };

  return (
    <div className="min-h-screen flex">
      {hata && <Bildirim mesaj={hata} tur="error" kapatFn={() => hataAyarla(null)} />}

      {/* Sol Taraf - Siyah Zemin */}
      <div className="hidden lg:flex lg:w-1/2 bg-black relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-neutral-950 to-black" />
        
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12">
          {/* Logo */}
          <div className="mb-12">
            <img 
              src="/simge.png" 
              alt="Taytech Logo" 
              className="h-32 w-auto object-contain"
            />
          </div>

          {/* Yazılar */}
          <div className="text-center max-w-md">
            <h1 className="text-4xl font-medium text-white leading-tight tracking-tight">
              Kurumsal Karar
            <br />
              <span className="text-neutral-400">Destek Sistemi</span>
            </h1>
            
            <p className="mt-6 text-base text-neutral-500 leading-relaxed">
              Taytech iç yapay zeka asistanı ile veriye dayalı kararlar alın.
              Kurumsal bilgilerinize anında erişin.
            </p>
                </div>

          {/* Alt yazı */}
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <span className="text-[10px] text-neutral-700 uppercase tracking-[0.3em]">
              Powered by Taytech
            </span>
          </div>
        </div>
      </div>

      {/* Sağ Taraf - Koyu Gri Zemin */}
      <div className="flex-1 flex items-center justify-center bg-neutral-900">
        <div className="w-full max-w-sm px-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-12">
            <img 
              src="/simge.png" 
              alt="Taytech Logo" 
              className="h-16 w-auto object-contain mb-4"
            />
            <span className="text-sm text-neutral-400 uppercase tracking-widest">
              Kurumsal Karar Destek Sistemi
            </span>
          </div>

          {/* Form Container */}
          <div className={`transition-opacity duration-200 ease-out ${gecisYapiliyor ? 'opacity-0' : 'opacity-100'}`}>
            {adim === 'kullanici' ? (
              /* Kullanıcı Adı Adımı */
              <div>
                <div className="mb-10">
                  <h2 className="text-4xl font-medium text-white tracking-tight">
                    Giriş Yap
                  </h2>
                  <p className="text-neutral-400 mt-3 text-base">
                    Kurumsal hesabınızla devam edin
                  </p>
          </div>

                <form onSubmit={kullaniciAdiGonder} className="space-y-6">
            <div>
                    <label 
                      htmlFor="kullaniciAdi" 
                      className="block text-sm font-medium text-neutral-400 mb-2 uppercase tracking-wider"
                    >
                Kullanıcı Adı
              </label>
                    <div className={`relative transition-all duration-200 ${
                      odaklanmisGirdi === 'kullaniciAdi' && !kullaniciHatali ? 'transform scale-[1.02]' : ''
                    }`}>
              <input
                id="kullaniciAdi"
                type="text"
                value={kullaniciAdi}
                        onChange={(e) => {
                          kullaniciAdiAyarla(e.target.value);
                          if (kullaniciHatali) kullaniciHataliAyarla(false);
                        }}
                        onFocus={() => odaklanmisGirdiAyarla('kullaniciAdi')}
                        onBlur={() => odaklanmisGirdiAyarla(null)}
                        placeholder="örn: kullanici"
                        disabled={yukleniyor}
                        className={`w-full px-4 py-4 bg-neutral-800 rounded-md text-white text-base placeholder-neutral-500 transition-all duration-200 border-2 ${
                          kullaniciHatali
                            ? 'border-red-500 bg-red-900/30'
                            : odaklanmisGirdi === 'kullaniciAdi'
                              ? 'border-neutral-600 shadow-lg'
                              : 'border-transparent shadow-sm hover:shadow-md'
                        } ${yukleniyor ? 'opacity-50' : ''}`}
                autoFocus
              />
            </div>
                    {kullaniciHatali && (
                      <p className="mt-2 text-sm text-red-500">Kullanıcı bulunamadı</p>
                    )}
            </div>

            <button
              type="submit"
              disabled={yukleniyor}
                    className="w-full py-4 px-4 bg-neutral-700 text-neutral-200 rounded-md font-medium text-base hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-600 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] mt-8"
            >
              {yukleniyor ? (
                <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                        Kontrol ediliyor...
                </span>
              ) : (
                      'Devam Et'
              )}
            </button>
          </form>

                {/* Footer */}
                <div className="mt-12 pt-8 border-t border-neutral-700">
                  <p className="text-center text-sm text-neutral-500">
                    Sadece yetkili Taytech personeli erişebilir.
                  </p>
                </div>
              </div>
            ) : (
              /* PIN Adımı */
              <div>
                <button
                  onClick={geriDon}
                  className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-8"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-base">Geri</span>
                </button>

                <div className="mb-10">
                  <h2 className="text-4xl font-medium text-white tracking-tight">
                    PIN Kodunuz
                  </h2>
                  <p className="text-neutral-400 mt-3 text-base">
                    6 haneli güvenlik kodunuzu girin
                  </p>
                </div>

                {/* PIN Kutuları */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-neutral-400 mb-2 uppercase tracking-wider">
                    Güvenlik Kodu
                  </label>
                  <div className="flex gap-2">
                    {pin.map((rakam, index) => (
                      <input
                        key={index}
                        ref={(el) => { pinRefs.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={rakam}
                        onChange={(e) => pinDegistir(index, e.target.value)}
                        onKeyDown={(e) => pinTusBasimi(index, e)}
                        onPaste={index === 0 ? pinYapistir : undefined}
                        disabled={yukleniyor || basarili || hatali}
                        className={`w-12 h-14 text-center text-2xl font-medium bg-neutral-800 text-white rounded-md transition-all duration-300 border-2 focus:outline-none ${
                          basarili
                            ? 'border-green-500 bg-green-900/30 text-green-400'
                            : hatali
                              ? 'border-red-500 bg-red-900/30 text-red-400'
                              : rakam
                                ? 'border-neutral-600 shadow-md'
                                : 'border-neutral-700 hover:border-neutral-600 focus:border-neutral-500 focus:shadow-lg'
                        } ${yukleniyor ? 'opacity-50' : ''}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Yükleniyor göstergesi */}
                {yukleniyor && (
                  <div className="flex justify-center mb-6">
                    <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}

                {/* Başarılı mesajı */}
                {basarili && (
                  <div className="flex flex-col items-center gap-3 mb-6">
                    <div className="flex items-center justify-center gap-2 text-green-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-base font-medium">Giriş başarılı</span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-400">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-sm">Sunucuya bağlanılıyor...</span>
                    </div>
                  </div>
                )}

                {/* Hatalı mesajı */}
                {hatali && (
                  <div className="flex items-center justify-center gap-2 text-red-400 mb-6">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-base font-medium">Hatalı PIN kodu</span>
                  </div>
                )}

                {/* Kullanıcı bilgisi */}
                <div className="text-center mt-6">
                  <p className="text-sm text-neutral-500">
                    <span className="text-neutral-300 font-medium">{kullaniciAdi}</span> olarak giriş yapılıyor
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Version */}
          <p className="text-center text-sm text-neutral-300 mt-6">
            v1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}
