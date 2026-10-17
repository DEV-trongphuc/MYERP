import { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/authStore';

export interface AuthUser {
    id: number;
    email: string;
    name: string;
    full_name?: string;
    role: string;
    department?: string;
    job_title?: string;
    team_id?: number;
    branch_id?: number;
    status?: string;
    avatar_url?: string;
    permissions?: Record<string, Record<string, boolean>> | null;
}

const MARKETING_ADMIN_ROLES = new Set([
    'admin',
    'superadmin',
    'super_admin',
    'director',
    'manager',
    'marketing',
    'mkt',
    'digital_marketing',
    'content',
    'ads',
]);

export function isMarketingAdminUser(user: Partial<AuthUser> | null | undefined): boolean {
    if (!user) return false;
    const role = String(user.role || '').trim().toLowerCase();
    if (MARKETING_ADMIN_ROLES.has(role)) return true;
    const dept = String(user.department || '').trim().toLowerCase();
    const jobTitle = String(user.job_title || '').trim().toLowerCase();
    if (dept.includes('marketing') || dept.includes('mkt') || jobTitle.includes('marketing') || jobTitle.includes('mkt')) {
        return true;
    }
    if (Number(user.team_id) === 3) {
        return true;
    }
    return false;
}

function readStoredUser(): AuthUser | null {
    try {
        const raw = localStorage.getItem('Ideas_user') || localStorage.getItem('user');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            ...parsed,
            name: parsed.name || parsed.full_name || parsed.email || '',
        };
    } catch {
        return null;
    }
}

export function useAuthUser(): AuthUser | null {
    const storeUser = useAuthStore((state) => state.user);
    const [fallbackUser, setFallbackUser] = useState<AuthUser | null>(() => readStoredUser());

    useEffect(() => {
        const handleStorageChange = () => {
            setFallbackUser(readStoredUser());
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    if (storeUser) {
        return {
            ...(storeUser as any),
            id: Number(storeUser.id),
            email: storeUser.email || '',
            name: (storeUser as any).name || storeUser.full_name || storeUser.email || '',
            full_name: storeUser.full_name,
            role: storeUser.role || 'viewer',
            department: (storeUser as any).department,
            job_title: (storeUser as any).job_title,
            team_id: (storeUser as any).team_id,
            branch_id: (storeUser as any).branch_id,
            avatar_url: storeUser.avatar_url,
        };
    }

    return fallbackUser;
}

export function useIsAdmin(): boolean {
    const user = useAuthUser();
    return isMarketingAdminUser(user);
}
