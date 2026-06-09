// ============================================================================
// Sağlayıcı-bağımsız LLM katmanı.
// Şu an Gemini kullanılıyor; başka sağlayıcıya geçmek için yeni bir
// LLMSaglayici implementasyonu yazıp `saglayiciOlustur` içinde döndürmek yeterli.
// ============================================================================

export interface AracTanimi {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AracCagrisi {
  ad: string;
  parametreler: Record<string, unknown>;
}

export interface LLMSaglayici {
  // Soruya göre bir araç seçer (veya düz metin cevap döner).
  aracSec(
    soru: string,
    sistemTalimat: string,
    araclar: AracTanimi[],
  ): Promise<{ aracCagrisi?: AracCagrisi; metin?: string }>;

  // Serbest metin üretir (özetleme / sınıflandırma için).
  metinUret(istem: string): Promise<string>;
}

// ----------------------------------------------------------------------------
// Gemini implementasyonu (REST API — ek bağımlılık gerekmez)
// ----------------------------------------------------------------------------
class GeminiSaglayici implements LLMSaglayici {
  private anahtar: string;
  private model: string;

  constructor(anahtar: string, model = 'gemini-2.5-flash') {
    this.anahtar = anahtar;
    this.model = model;
  }

  private get uc(): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.anahtar}`;
  }

  async aracSec(soru: string, sistemTalimat: string, araclar: AracTanimi[]) {
    const govde = {
      systemInstruction: { parts: [{ text: sistemTalimat }] },
      contents: [{ role: 'user', parts: [{ text: soru }] }],
      tools: [{ functionDeclarations: araclar }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    };

    const yanit = await fetch(this.uc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(govde),
    });

    if (!yanit.ok) {
      throw new Error(`Gemini hatası (${yanit.status}): ${await yanit.text()}`);
    }

    const veri = await yanit.json();
    const parcalar = veri?.candidates?.[0]?.content?.parts ?? [];

    for (const p of parcalar) {
      if (p.functionCall) {
        return {
          aracCagrisi: {
            ad: p.functionCall.name,
            parametreler: p.functionCall.args ?? {},
          },
        };
      }
    }
    const metin = parcalar.map((p: { text?: string }) => p.text ?? '').join(' ').trim();
    return { metin };
  }

  async metinUret(istem: string): Promise<string> {
    const govde = {
      contents: [{ role: 'user', parts: [{ text: istem }] }],
    };
    const yanit = await fetch(this.uc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(govde),
    });
    if (!yanit.ok) {
      throw new Error(`Gemini hatası (${yanit.status}): ${await yanit.text()}`);
    }
    const veri = await yanit.json();
    const parcalar = veri?.candidates?.[0]?.content?.parts ?? [];
    return parcalar.map((p: { text?: string }) => p.text ?? '').join(' ').trim();
  }
}

// Aktif sağlayıcıyı döndürür. Sağlayıcı değiştirmek için burayı düzenleyin.
export function saglayiciOlustur(): LLMSaglayici {
  const anahtar = Deno.env.get('GEMINI_API_KEY');
  if (!anahtar) {
    throw new Error('GEMINI_API_KEY tanımlı değil (Supabase secret olarak ekleyin).');
  }
  return new GeminiSaglayici(anahtar);
}
