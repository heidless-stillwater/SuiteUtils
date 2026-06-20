import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Gallery',
    description: 'Browse and manage your AI-generated image collection. Filter, tag, and organize your creations.',
    openGraph: {
        title: 'My Gallery - AI Image Studio',
        description: 'Browse and manage your AI-generated image collection.',
        type: 'website',
    },
    twitter: {
        card: 'summary',
        title: 'My Gallery - AI Image Studio',
        description: 'Browse and manage your AI-generated image collection.',
    },
};

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
