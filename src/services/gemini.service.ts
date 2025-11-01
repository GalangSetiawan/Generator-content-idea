import { Injectable, signal, effect, inject } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';
import { ContentIdea } from '../models/content-idea.model';
import { ApiKeyService } from './api-key.service';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private apiKeyService = inject(ApiKeyService);
  private ai: GoogleGenAI | null = null;
  public error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const apiKey = this.apiKeyService.apiKey();
      if (apiKey) {
        try {
          this.ai = new GoogleGenAI({ apiKey });
          this.error.set(null); // Clear previous errors when a new key is set
        } catch (e: any) {
          console.error("Failed to initialize GoogleGenAI:", e);
          this.ai = null;
          this.error.set(`Failed to initialize Google AI: ${e.message}. Please check your API key.`);
        }
      } else {
        this.ai = null;
        this.error.set("API Key is not set. Please provide your Google AI API key to use the app.");
      }
    });
  }

  private isReady(): boolean {
    if (!this.ai) {
      this.error.set("API Key is not set. Please provide your Google AI API key to use the app.");
      return false;
    }
    return true;
  }

  async validateApiKey(apiKey: string): Promise<{isValid: boolean; error?: string}> {
    if (!apiKey || !apiKey.trim()) {
        return { isValid: false, error: 'API Key cannot be empty.' };
    }
    try {
        const tempAi = new GoogleGenAI({ apiKey });
        // Use a lightweight, non-quota-consuming call like countTokens to validate
        await tempAi.models.countTokens({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: 'validate' }] },
        });
        return { isValid: true };
    } catch (e: any) {
        console.error("API Key validation failed:", e);
        let errorMessage = 'Invalid API Key or network issue. Please check the key and your connection.';
        // The Gemini API error for an invalid key usually contains this string.
        if (e.message && (e.message.includes('API key not valid') || e.message.includes('API_KEY_INVALID'))) {
            errorMessage = 'The provided API key is not valid. Please check it and try again.';
        }
        return { isValid: false, error: errorMessage };
    }
  }

  async generateContentIdeas(topic: string, customColumns: string[], count: number): Promise<any[]> {
    if (!this.isReady()) return [];
    this.error.set(null);
    try {
      const properties: { [key: string]: any } = {};
      customColumns.forEach(column => {
        properties[column] = {
          type: Type.STRING,
          description: `A creative and concise value for "${column}"`
        };
      });

      const schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: properties,
          required: customColumns
        }
      };

      const prompt = `Based on the topic "${topic}", generate ${count} unique and engaging content ideas. For each idea, provide a value for the following fields: ${customColumns.join(', ')}. Respond with a valid JSON array of objects. Do not include any markdown formatting or introductory text.`;
      
      const response = await this.ai!.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });

      const jsonString = response.text.trim();
      const result = JSON.parse(jsonString);
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error('Error generating content ideas:', e);
      this.error.set('Failed to generate content ideas. The model may have returned an unexpected format or your API key may be invalid. Please try again.');
      return [];
    }
  }

  async generateNarrationAndPrompts(idea: any, userPrompt: string): Promise<Partial<ContentIdea> | null> {
    if (!this.isReady()) return null;
    this.error.set(null);
    try {
      const prompt = `${userPrompt}

Setelah membuat narasi di atas, buatlah serangkaian prompt gambar yang sangat deskriptif secara visual dalam Bahasa Indonesia. Setiap prompt harus sesuai untuk segmen video berdurasi 5 detik dan cocok dengan narasi yang dibuat. Jumlah prompt harus sesuai dengan panjang narasi (misalnya, narasi 30 detik harus menghasilkan 6 prompt, narasi 60 detik menghasilkan 12 prompt).

ATURAN KONSISTENSI VISUAL (SANGAT PENTING):
1.  **Gaya Visual Tunggal:** Pilih SATU gaya artistik yang jelas (contoh: fotorealistik, gaya anime, lukisan cat minyak, seni digital sinematik) dan terapkan secara KONSISTEN di SEMUA prompt gambar. Jangan mencampur gaya.
2.  **Konsistensi Karakter:** Jika ada karakter yang muncul berulang (misalnya, seorang ilmuwan, seekor hewan spesifik, atau karakter bernama seperti 'ADI'), deskripsikan penampilan fisik mereka (pakaian, rambut, fitur wajah, dll.) secara konsisten di setiap prompt di mana mereka muncul. Hal ini untuk memastikan AI menggambar orang atau subjek yang sama di setiap gambar.

TEKNIK PROMPT LANJUTAN UNTUK KUALITAS MAKSIMAL (WAJIB DIIKUTI):
Setiap prompt gambar HARUS dibuat menggunakan teknik profesional berikut untuk memaksimalkan kualitas gambar dari model AI seperti Imagen 3.0:
1.  **Struktur Detail:** Jelaskan komposisi, sudut pandang kamera, pencahayaan, warna, suasana, dan detail spesifik lainnya secara mendalam. Panjang setiap prompt harus minimal 150 kata.
2.  **Kata Kunci Kualitas:** Sertakan kata kunci kualitas seperti: "fotorealistik", "sangat detail", "sinematik", "resolusi tinggi", "tajam", "profesional".
3.  **Detail Teknis Kamera & Pencahayaan:** Tambahkan detail teknis fotografi untuk hasil yang lebih profesional. Contoh: "lensa 35mm, aperture f/1.8, bokeh lembut, pencahayaan sinematik, golden hour, rembrandt lighting".
4.  **Negative Prompt:** Di akhir setiap prompt, SELALU tambahkan bagian "Negative prompt:" untuk menghindari elemen yang tidak diinginkan. Contoh: "Negative prompt: teks, watermark, jelek, cacat, kualitas rendah, gambar kartun, gambar tidak realistis, jari cacat".

Setiap prompt yang dihasilkan HARUS menggabungkan semua aturan di atas.

Balas dengan objek JSON yang valid. Jangan sertakan markdown. Objek JSON harus berisi 'narration' (sebuah string hasil dari permintaan pertama) dan 'imagePrompts' (sebuah array objek, di mana setiap objek memiliki 'timestamp' seperti '0-5s', '5-10s', dst., dan sebuah 'prompt' string).`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          narration: { 
            type: Type.STRING,
            description: "The full video narration."
          },
          imagePrompts: {
            type: Type.ARRAY,
            description: "An array of image prompts for the video, one for each 5-second segment, with the total number of prompts matching the narration length.",
            items: {
              type: Type.OBJECT,
              properties: {
                timestamp: {
                  type: Type.STRING,
                  description: "The time segment for the prompt, e.g., '0-5s'."
                },
                prompt: {
                  type: Type.STRING,
                  description: "The visually descriptive, high-quality, and technically detailed image prompt for this segment, including a negative prompt."
                }
              },
              required: ['timestamp', 'prompt']
            }
          }
        },
        required: ['narration', 'imagePrompts']
      };

      const response = await this.ai!.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        }
      });
      
      const jsonString = response.text.trim();
      const result = JSON.parse(jsonString);

      return result;
    } catch (e) {
      console.error('Error generating narration:', e);
      this.error.set('Failed to generate narration or image prompts. Please check your prompt and try again.');
      return null;
    }
  }

  async generateVideoPromptFromImagePrompt(originalPrompt: string): Promise<string | null> {
    if (!this.isReady()) return null;
    this.error.set(null);
    try {
      const prompt = `Based on the following descriptive AI image prompt, create a concise but dynamic prompt for an AI video generator to turn the static image into a short, 5-second video clip. The video prompt should focus on subtle movements, camera motion (like a slow zoom in or a gentle pan), and atmospheric effects (like drifting smoke or shimmering light). Do not describe the image again, only describe the motion.

Image Prompt: "${originalPrompt}"

Video Prompt:`;

      const response = await this.ai!.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      return response.text.trim();
    } catch (e) {
      console.error('Error generating video prompt:', e);
      this.error.set('Failed to generate the video prompt. Please try again.');
      return null;
    }
  }

  async generateImage(prompt: string): Promise<string | null> {
    if (!this.isReady()) return null;
    this.error.set(null);
    try {
      const response = await this.ai!.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '9:16',
        },
      });

      if (response.generatedImages && response.generatedImages.length > 0) {
        return response.generatedImages[0].image.imageBytes;
      }
      return null;
    } catch (e) {
      console.error('Error generating image:', e);
      this.error.set('Failed to generate the image. The model may have returned an error or your API key may be invalid. Please try again.');
      return null;
    }
  }
}