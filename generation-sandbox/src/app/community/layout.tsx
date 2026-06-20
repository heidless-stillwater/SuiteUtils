import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Community Hub',
    description: 'Vote for your favorite AI-generated art. Discover, upvote, and comment on stunning creations from the community.',
    openGraph: {
        title: 'Community Hub - AI Image Studio',
        description: 'Vote for your favorite AI-generated art. Discover, upvote, and comment on stunning creations from the community.',
        type: 'website',
    },
    twitter: {
        card: 'summary',
        title: 'Community Hub - AI Image Studio',
        description: 'Vote for your favorite AI-generated art.',
    },
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
