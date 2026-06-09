import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GirisProvider, girisKullan } from './context/AuthContext';
import { TemaProvider } from './context/ThemeContext';
import GirisSayfasi from './pages/LoginPage';
import SohbetSayfasi from './pages/ChatPage';
import { ortamHazirMi } from './services/supabase';

function OrtamUyarisi() {
  if (ortamHazirMi) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#b91c1c', color: '#fff', padding: '8px 16px',
      fontSize: 13, textAlign: 'center', fontFamily: 'system-ui, sans-serif',
    }}>
      ⚠️ Sunucu bağlantısı yapılandırılmamış — Vercel ortam değişkenleri
      (VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY) eksik. Giriş çalışmayacaktır.
    </div>
  );
}

function YukleniyorEkrani() {
  return (
    <div className="h-screen flex items-center justify-center bg-neutral-950">
      <svg className="animate-spin h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

function KorunmusYol({ children }: { children: React.ReactNode }) {
  const { girisYapildiMi, hazir } = girisKullan();
  if (!hazir) return <YukleniyorEkrani />;
  if (!girisYapildiMi) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AcikYol({ children }: { children: React.ReactNode }) {
  const { girisYapildiMi, hazir } = girisKullan();
  if (!hazir) return <YukleniyorEkrani />;
  if (girisYapildiMi) return <Navigate to="/chat" replace />;
  return <>{children}</>;
}

function UygulamaRotalari() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <AcikYol>
            <GirisSayfasi />
          </AcikYol>
        }
      />
      <Route
        path="/chat"
        element={
          <KorunmusYol>
            <SohbetSayfasi />
          </KorunmusYol>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function Uygulama() {
  return (
    <BrowserRouter>
      <OrtamUyarisi />
      <GirisProvider>
        <TemaProvider>
          <UygulamaRotalari />
        </TemaProvider>
      </GirisProvider>
    </BrowserRouter>
  );
}
