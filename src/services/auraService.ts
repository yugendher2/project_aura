import { GoogleGenAI, Type, Modality, FunctionDeclaration } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are AURA (Advanced User Responsive Assistant), a highly sophisticated AI interface similar to JARVIS. 
Your tone is professional, efficient, and slightly British-refined. 
You have access to simulated system controls. When a user asks to perform a laptop action (like opening an app, searching files, or changing settings), use the provided tools.
Always acknowledge the action being performed in your spoken and written response.
If you don't have a specific tool for an action, explain that you are simulating the interface but the physical hardware link is currently in 'read-only' mode for security.`;

const controlFunctions: FunctionDeclaration[] = [
  {
    name: "open_application",
    parameters: {
      type: Type.OBJECT,
      description: "Simulate opening a laptop application.",
      properties: {
        appName: { type: Type.STRING, description: "The name of the application to open (e.g., Chrome, Spotify, VS Code)." }
      },
      required: ["appName"]
    }
  },
  {
    name: "search_files",
    parameters: {
      type: Type.OBJECT,
      description: "Simulate searching for files on the local disk.",
      properties: {
        query: { type: Type.STRING, description: "The search term for the files." }
      },
      required: ["query"]
    }
  },
  {
    name: "adjust_system_setting",
    parameters: {
      type: Type.OBJECT,
      description: "Simulate adjusting a system setting like volume or brightness.",
      properties: {
        setting: { type: Type.STRING, description: "The setting to adjust (volume, brightness, wifi)." },
        value: { type: Type.STRING, description: "The target value or action (up, down, 50%, off)." }
      },
      required: ["setting", "value"]
    }
  }
];

export interface AuraAudioResponse {
  data: string;
  mimeType: string;
}

export class AuraService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  }

  async processCommand(message: string) {
    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: message }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: controlFunctions }],
      }
    });

    return response;
  }

  async speak(text: string): Promise<AuraAudioResponse | null> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say with a sophisticated, helpful assistant tone: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (part) {
        return { data: part.data, mimeType: part.mimeType };
      }
      return null;
    } catch (error) {
      console.error("TTS Error:", error);
      return null;
    }
  }
}

export const aura = new AuraService();
