import { TabloVerisi } from '../types';
import { temaKullan } from '../context/ThemeContext';
import { birlesik } from '../utils/cn';
import { excelIndir, pdfIndir } from '../utils/disaAktar';

interface TabloGostericiProps {
  veri: TabloVerisi;
}

export default function TabloGosterici({ veri }: TabloGostericiProps) {
  const { temaKoyuMu } = temaKullan();

  if (!veri.sutunAdlari || !veri.satirlar || veri.satirlar.length === 0) {
    return <p className={birlesik(
      'text-base italic mt-4',
      temaKoyuMu ? 'text-neutral-500' : 'text-neutral-400'
    )}>Sonuç verisi bulunamadı</p>;
  }

  return (
    <div className={birlesik(
      'mt-6 rounded-xl border overflow-hidden',
      temaKoyuMu ? 'border-neutral-700' : 'border-neutral-200'
    )}>
      {/* Header */}
      <div className={birlesik(
        'flex items-center justify-between px-5 py-3 border-b',
        temaKoyuMu 
          ? 'bg-neutral-800 border-neutral-700' 
          : 'bg-neutral-50 border-neutral-200'
      )}>
        <span className={birlesik(
          'text-sm font-medium',
          temaKoyuMu ? 'text-neutral-300' : 'text-neutral-700'
        )}>
          Sorgu Sonuçları
        </span>
        <div className="flex items-center gap-2">
          {/* Dışa aktarım */}
          <button
            onClick={() => excelIndir(veri)}
            title="Excel olarak indir"
            className={birlesik(
              'text-xs px-2.5 py-1 rounded-lg font-medium transition-colors',
              temaKoyuMu ? 'text-neutral-300 bg-neutral-700 hover:bg-neutral-600' : 'text-neutral-600 bg-neutral-200 hover:bg-neutral-300',
            )}
          >
            Excel
          </button>
          <button
            onClick={() => pdfIndir(veri)}
            title="PDF olarak indir"
            className={birlesik(
              'text-xs px-2.5 py-1 rounded-lg font-medium transition-colors',
              temaKoyuMu ? 'text-neutral-300 bg-neutral-700 hover:bg-neutral-600' : 'text-neutral-600 bg-neutral-200 hover:bg-neutral-300',
            )}
          >
            PDF
          </button>
          <span className={birlesik(
            'text-sm px-3 py-1 rounded-lg',
            temaKoyuMu ? 'text-neutral-400 bg-neutral-700' : 'text-neutral-600 bg-neutral-200'
          )}>
            {veri.satirlar.length} kayıt
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={temaKoyuMu ? 'bg-neutral-800/50' : 'bg-neutral-50'}>
              {veri.sutunAdlari.map((sutun, indeks) => (
                <th
                  key={indeks}
                  className={birlesik(
                    'px-5 py-4 text-left text-sm font-semibold uppercase tracking-wider whitespace-nowrap border-b',
                    temaKoyuMu 
                      ? 'text-neutral-200 border-neutral-700' 
                      : 'text-neutral-700 border-neutral-200'
                  )}
                >
                  {sutun}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={birlesik(
            'divide-y',
            temaKoyuMu ? 'divide-neutral-800' : 'divide-neutral-100'
          )}>
            {veri.satirlar.map((satir, satirIndeks) => (
              <tr
                key={satirIndeks}
                className={birlesik(
                  'transition-colors',
                  temaKoyuMu ? 'hover:bg-neutral-800/30' : 'hover:bg-neutral-50'
                )}
              >
                {satir.map((hucre, hucreIndeks) => (
                  <td
                    key={hucreIndeks}
                    className={birlesik(
                      'px-5 py-4 text-base whitespace-nowrap',
                      temaKoyuMu ? 'text-neutral-200' : 'text-neutral-800'
                    )}
                  >
                    {hucre !== null && hucre !== undefined ? String(hucre) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
