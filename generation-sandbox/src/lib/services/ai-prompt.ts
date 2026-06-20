import { GoogleGenAI } from '@google/genai';
import { getSecret } from '../config-helper';

export class AIPromptService {
    private client: GoogleGenAI;

    constructor(apiKey: string) {
        this.client = new GoogleGenAI({ apiKey });
    }

    /**
     * Enhances a simple prompt into a detailed masterpiece for image generation.
     */
    async enhancePrompt(prompt: string, style?: string, mood?: string): Promise<string> {
        if (!prompt || prompt.trim().length === 0) {
            throw new Error("Prompt is required for enhancement");
        }

        try {
            const model = 'gemini-2.5-flash'; // Fast and capable for text expansion

            const systemInstruction = `
        You are a world-class prompt engineer for AI image generation (e.g., Midjourney, DALL-E, Stable Diffusion).
        Your goal is to take a simple, short user prompt and expand it into a detailed, descriptive, and visually stunning masterpiece.
        
        Guidelines:
        1. Keep the original core subject but surround it with rich details.
        2. Describe lighting (e.g., "cinematic lighting", "golden hour", "volumetric fog").
        3. Describe textures and materials (e.g., "weathered leather", "iridescent glass", "soft velvet").
        4. Mention camera settings or artistic styles (e.g., "macro photography", "hyper-realistic", "surrealism", "cyberpunk aesthetic").
        5. Use evocative adjectives.
        6. Keep the final result concise but high-impact (usually 50-100 words).
        7. Return ONLY the enhanced prompt. No introductions, no explanations.
      `;

            let userPrompt = `Original Prompt: "${prompt}"\n`;
            if (style) userPrompt += `Target Art Style: ${style}\n`;
            if (mood) userPrompt += `Target Mood/Vibe: ${mood}\n`;
            userPrompt += `\nEnhanced Descriptive Prompt:`;

            const response = await this.client.models.generateContent({
                model,
                contents: [
                    { role: 'user', parts: [{ text: userPrompt }] }
                ],
                config: {
                    systemInstruction: { parts: [{ text: systemInstruction }] }
                }
            });

            const enhancedText = response.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!enhancedText) {
                throw new Error("Failed to generate enhanced prompt");
            }

            return enhancedText.trim();
        } catch (error: any) {
            console.error('[AI Prompt Service] Error:', error);
            throw new Error(error.message || "Failed to enhance prompt");
        }
    }

    /**
     * Suggests relevant tags based on a list of image prompts.
     */
    async suggestTags(prompts: string[]): Promise<string[]> {
        if (!prompts || prompts.length === 0) {
            return [];
        }

        try {
            const model = 'gemini-2.5-flash';
            const systemInstruction = `
        You are an expert content curator for an AI image gallery.
        Given a list of image prompts, suggest 5-8 relevant, descriptive tags.
        Tags should be single words or short phrases, lowercase, and no '#' symbol.
        Return ONLY a JSON array of strings.
      `;

            const response = await this.client.models.generateContent({
                model,
                contents: [
                    { role: 'user', parts: [{ text: `Image Prompts:\n${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nSuggested Tags:` }] }
                ],
                config: {
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    responseMimeType: 'application/json'
                }
            });

            const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!responseText) return [];

            const tags = JSON.parse(responseText);
            return Array.isArray(tags) ? tags : [];
        } catch (error: any) {
            console.error('[AI Prompt Service] Suggest Tags Error:', error);
            return [];
        }
    }
}

// Singleton helper
let aiPromptService: AIPromptService | null = null;

export async function getAIPromptService(): Promise<AIPromptService> {
    if (!aiPromptService) {
        const apiKey = await getSecret('GEMINI_API_KEY');
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY not configured in environment or database');
        }
        aiPromptService = new AIPromptService(apiKey);
    }
    return aiPromptService;
}
