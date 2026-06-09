import { useState } from 'react';
import { girisKullan } from '../context/AuthContext';
import { temaKullan } from '../context/ThemeContext';
import { sohbetKullan } from '../hooks/useChat';
import YanMenu from '../components/Sidebar';
import SohbetBasligi from '../components/ChatHeader';
import MesajListesi from '../components/MessageList';
import SohbetGirdisi from '../components/ChatInput';
import BosDurum from '../components/EmptyState';
import TemaSecimModal from '../components/ThemeSelectionModal';
import AraclarPaneli from '../components/AraclarPaneli';
import { birlesik } from '../utils/cn';

export default function SohbetSayfasi() {
  const { kullanici, cikisYap } = girisKullan();
  const { temaKoyuMu } = temaKullan();
  const [araclarAcik, araclarAcikAyarla] = useState(false);

  const {
    sohbetler,
    suankiSohbet,
    suankiSohbetId,
    yukleniyor,
    yeniSohbetOlustur,
    sohbetSec,
    sohbetiSil,
    mesajGonder,
  } = sohbetKullan();

  const [sidebarAcik, sidebarAcikAyarla] = useState(true);

  const mesajIsle = (mesaj: string) => {
    mesajGonder(mesaj);
  };

  const oneriIsle = (metin: string) => {
    mesajGonder(metin);
  };

  // Streaming durumunu kontrol et - son mesaj AI mesajı ve streamingMi true ise
  const streamingMi = suankiSohbet?.mesajlar.some(m => m.streamingMi) ?? false;

  return (
    <>
      {/* Tema Seçim Modalı */}
      <TemaSecimModal />

      {/* Veri Araçları Paneli (role göre) */}
      {kullanici && (
        <AraclarPaneli
          acik={araclarAcik}
          kapatFn={() => araclarAcikAyarla(false)}
          rol={kullanici.rol}
          kullaniciId={kullanici.id}
        />
      )}
      
      <div className={birlesik(
        'h-screen flex',
        temaKoyuMu ? 'bg-neutral-950' : 'bg-neutral-100'
      )}>
        {/* Sidebar */}
        <YanMenu
        sohbetler={sohbetler}
        suankiSohbetId={suankiSohbetId}
        acikMi={sidebarAcik}
        kapatFn={() => sidebarAcikAyarla(false)}
        acFn={() => sidebarAcikAyarla(true)}
        yeniSohbetFn={yeniSohbetOlustur}
        sohbetSecFn={sohbetSec}
        sohbetSilFn={sohbetiSil}
        cikisYapFn={cikisYap}
        kullaniciAdi={kullanici?.kullaniciAdi || 'Kullanıcı'}
      />

      {/* Main Content */}
      <main className={birlesik(
        'flex-1 flex flex-col min-w-0',
        temaKoyuMu ? 'bg-neutral-900' : 'bg-white'
      )}>
        <SohbetBasligi
          yeniSohbetFn={yeniSohbetOlustur}
          sidebarAcikMi={sidebarAcik}
          araclarAcFn={() => araclarAcikAyarla(true)}
        />

        {suankiSohbet && suankiSohbet.mesajlar.length > 0 ? (
          <MesajListesi mesajlar={suankiSohbet.mesajlar} yukleniyor={yukleniyor} />
        ) : (
          <BosDurum oneriFn={oneriIsle} />
        )}

        <SohbetGirdisi gonderFn={mesajIsle} devreDisi={yukleniyor} streamingMi={streamingMi} />
        </main>
      </div>
    </>
  );
}
