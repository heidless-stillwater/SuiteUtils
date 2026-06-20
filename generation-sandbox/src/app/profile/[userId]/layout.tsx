import { Metadata } from 'next';
import { adminDb } from '@/lib/firebase-admin';

interface LayoutProps {
    children: React.ReactNode;
    params: {
        userId: string;
    };
}

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: 'Creator Profile - AI Image Studio',
        description: 'View this creator\'s AI-generated artwork.',
    };
}

export default function ProfileLayout({ children }: LayoutProps) {
    return <>{children}</>;
}
