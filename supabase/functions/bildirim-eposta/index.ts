// ============================================================================
// bildirim-eposta — Gönderilmemiş bildirimleri e-posta ile yollar (Faz 3, opsiyonel)
//
// Çağrı: pg_cron ile periyodik veya manuel invoke. Resend kullanır.
// Gerekli secret'lar: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
//                     GONDEREN_EPOSTA (örn. "Taytech <bildirim@alaniniz.com>")
// Bu fonksiyon service role kullanır → tüm bildirimleri okuyabilir.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsBasliklari } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsBasliklari });

  const json = (g: unknown, s = 200) =>
    new Response(JSON.stringify(g), {
      status: s,
      headers: { ...corsBasliklari, 'Content-Type': 'application/json' },
    });

  try {
    const resendAnahtar = Deno.env.get('RESEND_API_KEY');
    const gonderen = Deno.env.get('GONDEREN_EPOSTA') ?? 'Taytech <onboarding@resend.dev>';
    if (!resendAnahtar) return json({ hata: 'RESEND_API_KEY tanımlı değil' }, 500);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Gönderilmemiş bildirimler
    const { data: bildirimler, error } = await supabase
      .from('bildirimler')
      .select('id, alici_id, hedef_rol, baslik, icerik')
      .eq('eposta_gonderildi', false)
      .limit(50);
    if (error) return json({ hata: error.message }, 500);
    if (!bildirimler?.length) return json({ gonderilen: 0 });

    let gonderilen = 0;
    for (const b of bildirimler) {
      // Alıcı e-postalarını topla
      let alicilar: string[] = [];
      if (b.alici_id) {
        const { data } = await supabase.from('profiller').select('eposta').eq('id', b.alici_id).single();
        if (data?.eposta) alicilar = [data.eposta];
      } else if (b.hedef_rol) {
        const { data } = await supabase.from('profiller').select('eposta').eq('rol', b.hedef_rol).eq('aktif', true);
        alicilar = (data ?? []).map((p: { eposta: string | null }) => p.eposta).filter(Boolean) as string[];
      }
      if (!alicilar.length) continue;

      const yanit = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendAnahtar}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: gonderen,
          to: alicilar,
          subject: b.baslik,
          html: `<p>${b.icerik ?? b.baslik}</p><hr><small>Taytech Veri Asistanı</small>`,
        }),
      });

      if (yanit.ok) {
        await supabase.from('bildirimler').update({ eposta_gonderildi: true }).eq('id', b.id);
        gonderilen++;
      }
    }

    return json({ gonderilen });
  } catch (e) {
    return json({ hata: e instanceof Error ? e.message : String(e) }, 500);
  }
});
