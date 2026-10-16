import { useMemo } from 'react';

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user' | string;
    status: string;
}

export function useAuthUser(): AuthUser | null {
    return useMemo(() => {
        const userStr = localStorage.getItem('user');
        if (!userStr) return null;
        try {
            return JSON.parse(userStr) as AuthUser;
        } catch {
            return null;
        }
    }, []);
}

export function useIsAdmin(): boolean {
    const user = useAuthUser();
    return user?.role === 'admin';
}

// Dual value declarations for verbatimModuleSyntax compatibility
export const AuthUser: any = undefined;
