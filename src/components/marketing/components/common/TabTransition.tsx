import React from 'react';

interface TabTransitionProps {
    children: React.ReactNode;
    className?: string;
}

const TabTransition: React.FC<TabTransitionProps> = ({ children, className = '' }) => {
    return (
        <div
            className={`animate-in slide-in-from-right-4 duration-300 ease-out ${className}`}
        >
            {children}
        </div>
    );
};

export default TabTransition;
