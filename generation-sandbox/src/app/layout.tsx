import type { Metadata } from 'next';
// import { Inter, Outfit } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/Toast';
import { TourProvider } from '@/context/TourContext';
import dynamic from 'next/dynamic';
const GuidedTour = dynamic(() => import('@/components/GuidedTour'), { ssr: false });
import QueryProvider from '@/providers/QueryProvider';
import { validateEnv } from '@/lib/schemas';

// Temporary system font fallbacks to bypass build-time network failures
const inter = { variable: 'font-inter', className: 'font-inter' };
const outfit = { variable: 'font-outfit', className: 'font-outfit' };

/*
const inter = Inter({ 
    subsets: ['latin'],
    variable: '--font-inter',
});

const outfit = Outfit({
    subsets: ['latin'],
    variable: '--font-outfit',
});
*/

// Validate environment variables on startup
// validateEnv();



export const metadata: Metadata = {
    title: {
        default: `Stillwater Studio v0.1.0 | Neural Generation`,
        template: `%s | Stillwater Studio v0.1.0`,
    },
    description: 'Bespoke AI image generation and prompt architecting. Part of the Stillwater Ecosystem.',
    icons: {
        icon: '/favicon.svg',
    },
    robots: {
        index: true,
        follow: true,
    },
};

const SovereignSentinel = dynamic(() => import('@/components/SovereignSentinel').then(mod => mod.SovereignSentinel), { ssr: false });

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={`${inter.variable} ${outfit.variable} font-sans antialiased`}>
                <QueryProvider>
                    <AuthProvider>
                        <SovereignSentinel />
                        <ToastProvider>
                            <TourProvider>
                                <GuidedTour />
                                {children}
                            </TourProvider>
                        </ToastProvider>
                    </AuthProvider>
                </QueryProvider>
            </body>
        </html>
    );
}
