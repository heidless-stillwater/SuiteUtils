// Mad-Libs Style Prompt Templates
import { MadLibsSelection } from './types';

export const PROMPT_CATEGORIES = {
    subjects: [
        'A majestic cat',
        'A friendly robot',
        'A mystical dragon',
        'A serene landscape',
        'A futuristic city',
        'A vintage car',
        'A magical forest',
        'A space explorer',
        'A cozy cottage',
        'A fierce warrior',
        'An ancient temple',
        'A playful puppy',
        'A wise owl',
        'A beautiful butterfly',
        'A mysterious detective',
    ],

    actions: [
        'flying through clouds',
        'exploring a cave',
        'dancing in the rain',
        'reading a book',
        'playing music',
        'cooking a feast',
        'gardening at sunset',
        'sailing on calm waters',
        'climbing a mountain',
        'watching the stars',
        'walking along a beach',
        'meditating peacefully',
        'running through a meadow',
        'painting a masterpiece',
        'enjoying a cup of tea',
    ],

    styles: [
        'Photorealistic',
        'Anime/Manga style',
        'Oil painting',
        'Watercolor',
        'Digital art',
        'Pixel art',
        'Impressionist',
        'Pop art',
        'Art Nouveau',
        'Cyberpunk',
        'Steampunk',
        'Minimalist',
        'Surrealist',
        'Comic book',
        'Studio Ghibli inspired',
    ],

    moods: [
        'Peaceful and calm',
        'Mysterious and dark',
        'Vibrant and energetic',
        'Nostalgic and warm',
        'Dramatic and intense',
        'Whimsical and playful',
        'Elegant and sophisticated',
        'Cozy and comfortable',
        'Epic and grand',
        'Melancholic and thoughtful',
    ],

    settings: [
        'during golden hour',
        'under a starry night sky',
        'in a foggy morning',
        'during a thunderstorm',
        'on a sunny day',
        'in autumn with falling leaves',
        'during winter snowfall',
        'at sunrise',
        'in spring bloom',
        'under northern lights',
    ],
};

export function buildPromptFromMadLibs(selection: MadLibsSelection): string {
    const mainParts = [];
    if (selection.subject) mainParts.push(selection.subject);
    if (selection.action) mainParts.push(selection.action);
    if (selection.setting) mainParts.push(selection.setting);

    let result = mainParts.join(' ');
    if (result) result += '. ';

    if (selection.style) {
        result += `Rendered in ${selection.style} style. `;
    }

    if (selection.mood) {
        result += `The mood is ${selection.mood.toLowerCase()}.`;
    }

    return result.trim();
}

// Curated prompts for quick generation (Casual mode)
export const FEATURED_PROMPTS = [
    {
        id: 'cosmic-cat',
        title: 'Cosmic Cat',
        prompt: 'A majestic space cat floating through a colorful nebula, photorealistic with cinematic lighting',
        category: 'Fantasy',
    },
    {
        id: 'neon-city',
        title: 'Neon City',
        prompt: 'A futuristic cyberpunk cityscape at night with neon signs and flying cars, rain-soaked streets reflecting the lights',
        category: 'Sci-Fi',
    },
    {
        id: 'enchanted-forest',
        title: 'Enchanted Forest',
        prompt: 'A magical forest with glowing mushrooms and fairy lights, mystical fog, Studio Ghibli inspired',
        category: 'Fantasy',
    },
    {
        id: 'retro-robot',
        title: 'Retro Robot',
        prompt: 'A friendly vintage robot from the 1950s serving coffee in a retro diner, warm nostalgic lighting',
        category: 'Retro',
    },
    {
        id: 'zen-garden',
        title: 'Zen Garden',
        prompt: 'A peaceful Japanese zen garden with raked sand, cherry blossoms, and a small wooden bridge, watercolor style',
        category: 'Nature',
    },
    {
        id: 'steampunk-explorer',
        title: 'Steampunk Explorer',
        prompt: 'A steampunk explorer with brass goggles and mechanical arm standing before a massive clockwork machine',
        category: 'Steampunk',
    },
];
