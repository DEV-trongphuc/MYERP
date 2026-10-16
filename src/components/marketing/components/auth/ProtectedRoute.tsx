import * as React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    // [PERF FIX] Synchronous auth check via useState lazy initializer.
    // Previously: useEffect + null state → spinner flash on EVERY tab switch.
    // Now: reads localStorage synchronously at first render → zero spinner delay.
    const authData = React.useMemo(() => {
        const authStatus = localStorage.getItem('isAuthenticated');
        const userStr = localStorage.getItem('user');
        if (authStatus !== 'true' || !userStr) return { isAuthenticated: false };
        
        try {
            const user = JSON.parse(userStr);
            return {
                isAuthenticated: true,
                isApproved: user.status === 'approved'
            };
        } catch (e) {
            return { isAuthenticated: false };
        }
    }, []);

    if (!authData.isAuthenticated || !authData.isApproved) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;

