import CollectionDetailClient from './CollectionDetailClient';

export async function generateStaticParams() {
    return [{ id: 'demo' }];
}

export default function CollectionDetailPage({ params }: { params: { id: string } }) {
    return <CollectionDetailClient id={params.id} />;
}
