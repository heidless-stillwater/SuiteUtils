import { FontOption } from './types';

export const CURATED_FONTS: FontOption[] = [
    // Serif
    {
        family: 'Playfair Display',
        category: 'serif',
        weights: [400, 700, 900],
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap'
    },
    {
        family: 'Lora',
        category: 'serif',
        weights: [400, 500, 700],
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;700&display=swap'
    },
    // Sans-Serif
    {
        family: 'Inter',
        category: 'sans-serif',
        weights: [400, 600, 800],
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap'
    },
    {
        family: 'Montserrat',
        category: 'sans-serif',
        weights: [400, 700, 900],
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap'
    },
    // Display
    {
        family: 'Bebas Neue',
        category: 'display',
        weights: [400],
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap'
    },
    {
        family: 'Righteous',
        category: 'display',
        weights: [400],
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Righteous&display=swap'
    },
    // Handwriting
    {
        family: 'Dancing Script',
        category: 'handwriting',
        weights: [400, 700],
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap'
    },
    {
        family: 'Pacifico',
        category: 'handwriting',
        weights: [400],
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap'
    }
];

export const getGoogleFontsImportUrl = (fonts: FontOption[]) => {
    // Generate a single import URL for all curated fonts to optimize loading
    const families = fonts.map(f => {
        const weightStr = f.weights.length > 0 ? `:wght@${f.weights.join(';')}` : '';
        return `family=${f.family.replace(/ /g, '+')}${weightStr}`;
    }).join('&');

    return `https://fonts.googleapis.com/css2?${families}&display=swap`;
};
