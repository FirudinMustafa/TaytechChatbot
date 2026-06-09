# TaytechChatbot — Kurumsal Veri Asistanı

Taytech için, şirketin tüm verilerini (stok, muhasebe, satış, müşteri, servis, personel…)
tek bir sohbet ekranından **normal Türkçe** ile yönetilebilir ve sorgulanabilir hale getiren
yapay zeka asistanı.

## Özellikler
- 💬 Doğal dilde sorgu (Gemini function-calling → güvenli RPC)
- 🔐 Rol bazlı erişim: Müdür, Muhasebe, Depo, Resepsiyon (Supabase RLS)
- 📝 Form + Excel ile veri girişi
- 🔔 Düşük stok bildirimi (Realtime) + günlük otomatik müdür raporu (pg_cron)
- 📷 Fatura/fiş OCR (Gemini vision)
- 📊 Logolu/tarihli Excel & PDF dışa aktarım
- 👁️ Müdür analitiği: kim, ne zaman, ne sordu + niyet sınıflandırması

## Teknolojiler
React + Vite + TypeScript + TailwindCSS · Supabase (Postgres, Auth, Realtime, Edge Functions) · Google Gemini

## Kurulum
Ayrıntılı adımlar için **[KURULUM.md](./KURULUM.md)** dosyasına bakın.

```bash
npm install
cp .env.example .env   # Supabase URL + anon key girin
npm run dev            # http://localhost:3000
```

## Sunum
`public/sunum.html` — projeyi anlatan hazır sunum (`http://localhost:3000/sunum.html`).
