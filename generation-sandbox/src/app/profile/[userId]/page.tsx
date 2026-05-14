import ProfileClient from './ProfileClient';

export function generateStaticParams() {
    return [{ userId: '1' }];
}

export const dynamic = 'force-static';
export const dynamicParams = true;

export default function ProfilePage({ params }: { params: { userId: string } }) {
    return <ProfileClient />;
}
