'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/ui/Icons';

export default function EntryRedirectClient({ entryId }: { entryId: string }) {
    const router = useRouter();

    useEffect(() => {
        router.replace(`/community?entryId=${entryId}`);
    }, [entryId, router]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
}
