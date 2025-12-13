import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ImageToGenerate } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeLayoutAndGenerateCode = async (
  base64Image: string,
  preferences: { theme: string; colorPalette: string }
): Promise<{ html: string; images: ImageToGenerate[] }> => {
  
  // Using PRO for maximum visual fidelity
  const model = "gemini-3-pro-preview";

  const systemPrompt = `
    You are a world-class Frontend Engineer specializing in cloning designs with 100% fidelity.
    
    CRITICAL REQUIREMENTS:
    1. **Responsive Layout**: The provided image is a Desktop view. You MUST write Mobile-First Tailwind CSS. 
       - Start with stacked layouts for mobile (block, w-full).
       - Use 'md:' and 'lg:' prefixes to create the multi-column layout seen in the image.
    2. **Section Isolation**: You MUST wrap every distinct logical section (Navbar, Hero, Features, Footer) in a semantic tag with a unique, descriptive ID (e.g., id="hero-section").
    3. **Visual Fidelity**: Match border-radius, box-shadows, gradients, and font-weights exactly. Use arbitrary values (e.g., h-[500px]) if needed.
    4. **Images**: 
       - Use <img> tags with unique IDs.
       - IMPORTANT: For the 'images' array output, provide extremely detailed, vivid descriptions of the images in the screenshot so they can be recreated by AI. Include style, lighting, colors, and subject matter.
       - SRC: 'https://placehold.co/600x400/222/FFF?text=Loading...'
    5. **Icons**: Use <i class="fa-solid fa-icon"></i>.
    
    Output strictly JSON.
  `;

  const userPrompt = `
    Clone this website screenshot.
    Theme Context: ${preferences.theme || "Same as image"}.
    Color Context: ${preferences.colorPalette || "Same as image"}.
    
    Return JSON with:
    - html: The full <body> content.
    - images: Array of images to generate (id, description, aspectRatio).
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      html: { type: Type.STRING },
      images: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            description: { type: Type.STRING },
            aspectRatio: { type: Type.STRING, enum: ["1:1", "3:4", "4:3", "16:9", "9:16"] }
          },
          required: ["id", "description", "aspectRatio"]
        }
      }
    },
    required: ["html", "images"]
  };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/png", data: base64Image } },
          { text: userPrompt }
        ]
      },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const data = JSON.parse(text);
    const images: ImageToGenerate[] = data.images.map((img: any) => ({
      ...img,
      status: 'pending'
    }));

    return { html: data.html, images: images };

  } catch (error) {
    console.error("Analysis Error:", error);
    throw error;
  }
};

export const refineHtmlWithAI = async (
  currentHtml: string, 
  instructions: string, 
  isSnippet: boolean = false,
  base64ContextImage?: string
): Promise<string> => {
  // Flash is good for code, but Pro might be better for complex visual instructions if provided an image.
  // Let's use Flash for speed unless it fails often. 
  const model = "gemini-2.5-flash"; 
  
  const systemPrompt = `
    You are a code editor. Update the HTML code based on the user's instruction.
    CRITICAL: 
    - Do NOT remove existing IDs or structure unless asked.
    - Do NOT remove Tailwind classes unless they conflict with the instruction.
    - Return ONLY the updated HTML string.
  `;

  const parts: any[] = [];
  if (base64ContextImage) {
    parts.push({ inlineData: { mimeType: "image/png", data: base64ContextImage } });
    parts.push({ text: "Reference the original design image provided above if the instruction asks to restore or match it." });
  }

  parts.push({ 
    text: `
      CURRENT CODE:
      ${currentHtml}

      INSTRUCTION:
      ${instructions}
    ` 
  });

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "text/plain"
      }
    });
    return response.text?.trim() || currentHtml;
  } catch (e) {
    console.error(e);
    return currentHtml;
  }
}

export const generateAssetImage = async (prompt: string, aspectRatio: string): Promise<string> => {
  // User requested "nano bana" (flash-image) for assets, but we ensure prompts are rich.
  const model = "gemini-2.5-flash-image";
  
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data");
  } catch (error) {
    console.error("Image Gen Error:", error);
    // Return a placeholder if generation fails
    return `https://placehold.co/600x400/333/FFF?text=Generation+Failed`;
  }
};