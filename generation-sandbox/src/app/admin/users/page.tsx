'use client';

import { useAdminUsers } from '@/hooks/useAdminUsers';
import { Icons } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { UserManagementCard } from '../components/UserManagementCard';

export default function UserManagementPage() {
    const {
        users,
        loading,
        searching,
        searchQuery,
        setSearchQuery,
        updatingUser,
        handleSearch,
        handleUpdateUserDetails,
        handleToggleBadge
    } = useAdminUsers();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Search Bar */}
            <div className="flex gap-2 p-1 bg-[#0a0a0f] border border-border rounded-2xl shadow-sm">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search by @username..."
                    className="flex-1 bg-transparent px-6 py-3 text-sm text-white focus:outline-none font-medium"
                />
                <Button
                    onClick={() => handleSearch()}
                    disabled={searching}
                    className="px-8 h-12 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest"
                    isLoading={searching}
                >
                    Search
                </Button>
            </div>

            {/* Users List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <Icons.spinner className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted">Querying User Database</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {users.map((u) => (
                        <UserManagementCard
                            key={u.uid}
                            user={u}
                            updatingUserId={updatingUser}
                            onUpdateRole={(role) => handleUpdateUserDetails(u.uid, { role })}
                            onUpdateCredits={(amount) => handleUpdateUserDetails(u.uid, { creditsChange: amount })}
                            onToggleBadge={(badgeId) => handleToggleBadge(u.uid, u.badges || [], badgeId)}
                        />
                    ))}

                    {users.length === 0 && (
                        <div className="py-24 text-center border-2 border-dashed border-border rounded-[2.5rem] bg-background-secondary/30">
                            <div className="text-4xl mb-4 opacity-50">👤</div>
                            <p className="text-foreground-muted italic font-medium">No users match your criteria.</p>
                            <Button
                                variant="ghost"
                                onClick={() => { setSearchQuery(''); handleSearch(''); }}
                                className="text-primary font-black uppercase text-xs mt-4"
                            >
                                Reset Search
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
