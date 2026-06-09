import { temaKullan } from '../context/ThemeContext';
import { birlesik } from '../utils/cn';
import { Rol } from '../types';

interface BosDurumProps {
  oneriFn: (metin: string) => void;
  rol?: Rol;
}

// Role göre örnek sorular — her kullanıcı kendi işine uygun, yetkisi olan önerileri görür.
const ROL_SORULARI: Record<Rol, string[]> = {
  mudur: [
    'Bu ayki kâr-zarar durumu nedir?',
    'En çok giden ürün hangisi?',
    'Vadesi geçen alacaklar kim?',
    'Kritik seviyedeki stoklar',
  ],
  muhasebe: [
    'Bu ay ne kazandık, ne harcadık?',
    'Gider dökümü nedir?',
    'Vadesi geçen alacaklar kim?',
    'Bu dönem kim izinli?',
  ],
  depo: [
    'Stok durumu nedir?',
    'Kritik seviyedeki ürünler',
    'En çok giden ürün hangisi?',
    'Ne sipariş etmeliyim?',
  ],
  resepsiyon: [
    'Açık teklifler neler?',
    'Bekleyen sevkiyatlar',
    'Bir siparişin durumu',
    'Açık servis kayıtları',
  ],
};

const VARSAYILAN_SORULAR = [
  'Stok durumu nedir?',
  'En çok giden ürün hangisi?',
  'Kritik seviyedeki ürünler',
  'Açık görevlerim',
];

export default function BosDurum({ oneriFn, rol }: BosDurumProps) {
  const { temaKoyuMu } = temaKullan();
  const ornekSorular = rol ? ROL_SORULARI[rol] : VARSAYILAN_SORULAR;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8">
        <div className={birlesik(
          'w-20 h-20 rounded-full flex items-center justify-center p-4',
          temaKoyuMu ? 'bg-neutral-800' : 'bg-neutral-100'
        )}>
          <img
            src="/simge.png"
            alt="Ercüment"
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* Title */}
      <h1 className={birlesik(
        'text-2xl font-medium mb-2',
        temaKoyuMu ? 'text-neutral-100' : 'text-neutral-900'
      )}>
        Size nasıl yardımcı olabilirim?
      </h1>
      <p className={birlesik(
        'text-sm mb-12',
        temaKoyuMu ? 'text-neutral-500' : 'text-neutral-500'
      )}>
        Ben Ercüment, Taytech kurumsal asistanınız.
      </p>

      {/* Suggestions - Minimal Pills */}
      <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
        {ornekSorular.map((soru) => (
          <button
            key={soru}
            onClick={() => oneriFn(soru)}
            className={birlesik(
              'px-4 py-2.5 rounded-full text-sm transition-all',
              temaKoyuMu
                ? 'bg-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
                : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200'
            )}
          >
            {soru}
          </button>
        ))}
      </div>
    </div>
  );
}
