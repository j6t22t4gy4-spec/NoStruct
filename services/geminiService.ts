import { AppMode, Message } from "../types";
import { supabase } from "./supabaseService";

/**
 * [하얀 화면 복구 및 최적화 버전]
 * 1. @google/genai 임포트 제거 (브라우저 크래시 원인 1순위)
 * 2. process.env 참조 제거 (브라우저 크래시 원인 2순위)
 * 3. 모든 AI 요청은 배포된 Supabase 'chat' 함수로 통일
 */

export const generateEducationalResponse = async (
  mode: AppMode,
  prompt: string,
  history: Message[] = [],
  mediaParts: any[] = []
) => {
  try {
    // 배포 성공한 이름인 'chat'을 호출합니다.
    const { data, error } = await supabase.functions.invoke('chat', {
      body: {
        mode,
        prompt,
        // 서버로 보낼 대화 맥락 정제
        history: history.slice(-10).map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content || "" }]
        })),
        mediaParts 
      }
    });

    if (error) {
      console.error("Supabase Function Error:", error);
      throw error;
    }

    return {
      text: data?.reply || "", 
      urls: data?.urls || [],
      thinking: data?.thinking,
      searchHtml: data?.searchHtml || "",
      aiMedia: data?.aiMedia
    };
  } catch (err) {
    console.error("AI Service 호출 실패:", err);
    return { text: "AI 서비스 연결에 실패했습니다. 관리자에게 문의하세요.", urls: [] };
  }
};

/**
 * 받아쓰기 기능도 안전하게 Supabase 함수를 거치도록 수정
 */
export const transcribeAudio = async (base64Audio: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('chat', {
      body: {
        prompt: "이 오디오를 정확하게 받아쓰기 하세요.",
        mediaParts: [{ inlineData: { mimeType: 'audio/wav', data: base64Audio } }]
      }
    });
    if (error) throw error;
    return data?.reply || "";
  } catch (err) {
    console.error("Transcription Error:", err);
    return "오디오 인식 실패";
  }
};

// --- Live API 관련 함수 (에러 방지를 위해 빈 함수/최소 로직으로 대체) ---

export const getAIClient = () => {
  console.warn("Client-side AI Client는 보안을 위해 비활성화되었습니다.");
  return null;
};

export const encodePCM = (bytes: Uint8Array) => {
  const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  return btoa(binary);
};

export const decodePCM = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}