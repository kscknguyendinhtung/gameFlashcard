
import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const evaluatePronunciation = async (originalText: string, audioBase64: string): Promise<{ score: number; feedback: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            text: `Bạn là trợ lý ngôn ngữ. Hãy đánh giá phát âm cho văn bản: "${originalText}". So sánh với audio được gửi. 
            Nếu người dùng nói kèm các từ như "level 1", "level 5", "mức độ 4", hãy ghi chú lại trong feedback.
            Trả về JSON object: {"score": 0-100, "feedback": "Nhận xét ngắn gọn + (Ví dụ: 'Phát âm tốt, bạn đã chọn Mức độ 5') nếu có"}.`
          },
          {
            inlineData: {
              mimeType: "audio/pcm;rate=16000",
              data: audioBase64
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    const result = JSON.parse(text || '{"score": 0, "feedback": "Lỗi phân tích"}');
    return result;
  } catch (error) {
    console.error("Pronunciation evaluation error:", error);
    return { score: 0, feedback: "Không thể đánh giá phát âm." };
  }
};

export const generateTTS = async (text: string, voiceName: string = 'Kore'): Promise<string | undefined> => {
  if (!text) return undefined;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("TTS Error:", error);
    return undefined;
  }
};
