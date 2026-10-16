/**
 * Helper utilities for list/integration filtering
 * Updated to use 'type' field instead of hardcoded source checks
 */

/**
 * Check if a list is static (Manual, Import, Split, etc.)
 * Uses the 'type' field from database
 */
export const isStaticList = (list: any): boolean => {
    // Primary check: use 'type' field if available
    if (list.type) {
        return list.type === 'static';
    }

    // Fallback for backward compatibility (before migration)
    const STATIC_SOURCES = ['Manual', 'Import CSV', 'Bulk Import'];
    const isStaticSource = STATIC_SOURCES.includes(list.source);
    const isSplitSource = list.source?.startsWith('Split');

    return isStaticSource || isSplitSource;
};

/**
 * Check if a list is from sync source (Google Sheets, MISA, etc.)
 * Uses the 'type' field from database
 */
export const isSyncList = (list: any): boolean => {
    // Primary check: use 'type' field if available
    if (list.type) {
        return list.type === 'sync';
    }

    // Fallback for backward compatibility (before migration)
    const SYNC_SOURCES = ['Google Sheets', 'MISA CRM'];
    return SYNC_SOURCES.includes(list.source);
};

/**
 * Legacy alias for backward compatibility
 * @deprecated Use isStaticList instead
 */
export const isManualList = isStaticList;

/**
 * Get platform name from integration type
 */
export const getPlatformName = (type: string): string => {
    const platforms: Record<string, string> = {
        'google_sheets': 'Google Sheets',
        'misa': 'MISA CRM'
    };
    return platforms[type] || 'N/A';
};
