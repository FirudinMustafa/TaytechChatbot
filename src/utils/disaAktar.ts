import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TabloVerisi } from '../types';

const SIRKET = 'TAYTECH';
const ALT_BASLIK = 'Kurumsal Veri Asistanı';

function tarihSaat(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function dosyaAdi(taban: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${taban}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

// --- Varlık yükleme (logo + Türkçe font), modül düzeyinde önbelleğe alınır ---
function abToBase64(buf: ArrayBuffer): string {
  let s = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

let logoSozu: Promise<string | null> | null = null;
function logoGetir(): Promise<string | null> {
  if (!logoSozu) {
    logoSozu = fetch('/logo.png')
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => new Promise<string>((coz) => {
        const fr = new FileReader();
        fr.onload = () => coz(String(fr.result));
        fr.readAsDataURL(b);
      }))
      .catch(() => null);
  }
  return logoSozu;
}

let fontSozu: Promise<string | null> | null = null;
function fontGetir(): Promise<string | null> {
  if (!fontSozu) {
    fontSozu = fetch('/fonts/NeueHaasDisplayRoman.ttf')
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((buf) => abToBase64(buf))
      .catch(() => null);
  }
  return fontSozu;
}

// ============================================================================
// Excel (.xlsx) — kurumsal başlık + tarih (Türkçe karakterler UTF-8 ile korunur)
// ============================================================================
export function excelIndir(veri: TabloVerisi, taban = 'taytech-rapor', baslik = 'Veri Tablosu') {
  const ust = [
    [SIRKET],
    [`${ALT_BASLIK} — ${baslik}`],
    [`Tarih: ${tarihSaat()}`],
    [],
  ];
  const govde = [veri.sutunAdlari, ...veri.satirlar.map((s) => s.map((h) => (h ?? '') as string | number))];
  const sayfa = XLSX.utils.aoa_to_sheet([...ust, ...govde]);

  // Sütun genişlikleri
  sayfa['!cols'] = veri.sutunAdlari.map((s, i) => {
    const enUzun = Math.max(s.length, ...veri.satirlar.map((r) => String(r[i] ?? '').length));
    return { wch: Math.min(Math.max(enUzun + 2, 12), 40) };
  });
  // Başlık satırlarını birleştir
  const sonSutun = Math.max(veri.sutunAdlari.length - 1, 1);
  sayfa['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: sonSutun } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: sonSutun } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: sonSutun } },
  ];

  const kitap = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(kitap, sayfa, 'Rapor');
  XLSX.writeFile(kitap, `${dosyaAdi(taban)}.xlsx`);
}

// ============================================================================
// PDF — logo + kurumsal başlık + tarih + Türkçe font (Neue Haas)
// ============================================================================
export async function pdfIndir(veri: TabloVerisi, taban = 'taytech-rapor', baslik = 'Veri Tablosu') {
  const doc = new jsPDF();
  const [logo, fontB64] = await Promise.all([logoGetir(), fontGetir()]);

  // Türkçe destekli font
  let yaziTipi = 'helvetica';
  if (fontB64) {
    try {
      doc.addFileToVFS('NHD.ttf', fontB64);
      doc.addFont('NHD.ttf', 'NHD', 'normal');
      yaziTipi = 'NHD';
    } catch { /* font yüklenemedi, varsayılan kalır */ }
  }

  const sayfaGen = doc.internal.pageSize.getWidth();

  // Logo (sol üst)
  if (logo) {
    try { doc.addImage(logo, 'PNG', 14, 9, 32, 14); } catch { /* logo eklenemedi */ }
  }

  // Şirket adı + alt başlık (logonun sağında)
  doc.setFont(yaziTipi, 'normal');
  doc.setFontSize(16);
  doc.text(SIRKET, 52, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${ALT_BASLIK} — ${baslik}`, 52, 25);
  doc.text(`Tarih: ${tarihSaat()}`, sayfaGen - 14, 18, { align: 'right' });
  doc.setTextColor(0);

  // Ayraç çizgi
  doc.setDrawColor(220);
  doc.line(14, 32, sayfaGen - 14, 32);

  autoTable(doc, {
    startY: 38,
    head: [veri.sutunAdlari],
    body: veri.satirlar.map((s) => s.map((h) => (h !== null && h !== undefined ? String(h) : '—'))),
    styles: { font: yaziTipi, fontSize: 9, cellPadding: 3 },
    headStyles: { font: yaziTipi, fillColor: [23, 23, 23], textColor: 255, fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 14, right: 14 },
  });

  // Alt bilgi
  const sayfaYuk = doc.internal.pageSize.getHeight();
  doc.setFont(yaziTipi, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`${SIRKET} • ${ALT_BASLIK}`, 14, sayfaYuk - 8);

  doc.save(`${dosyaAdi(taban)}.pdf`);
}
