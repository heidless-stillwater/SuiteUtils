import { Metadata } from 'next';
import { adminDb } from '@/lib/firebase-admin';
import EntryRedirectClient from './EntryRedirectClient';

interface PageProps {
    params: {
        entryId: string;
    };
}

export function generateStaticParams() {
    return [{ entryId: '1' }];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { entryId } = params;

    try {
        const entryDoc = await adminDb.collection('leagueEntries').doc(entryId).get();

        if (!entryDoc.exists) {
            return {
                title: 'Entry Not Found',
                description: 'This community entry could not be found.'
            };
        }

        const entry = entryDoc.data()!;
        const title = `AI Art by ${entry.authorName} - Community Hub`;
        const description = entry.prompt || 'Check out this amazing AI-generated art in the Community Hub!';
        const imageUrl = entry.imageUrl;

        return {
            title,
            description,
            openGraph: {
                title,
                description,
                images: [{ url: imageUrl }],
                type: 'website',
            },
            twitter: {
                card: 'summary_large_image',
                title,
                description,
                images: [imageUrl],
            },
        };
    } catch (error) {
        console.error('Error generating metadata:', error);
        return {
            title: 'Community Hub',
            description: 'Vote for your favorite AI-generated images.'
        };
    }
}

export const dynamic = 'force-static';
export const dynamicParams = false;

export default function EntryRedirectPage({ params }: PageProps) {
    return <EntryRedirectClient entryId={params.entryId} />;
}
