import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Marketing-scoped className combiner.
 * `twMerge` resolves conflicting Tailwind utilities so a caller's `className`
 * (e.g. `w-44`, `mb-0`, `h-10`) deterministically overrides the primitive's defaults,
 * independent of the order utilities are emitted in the generated CSS.
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

/**
 * Legacy MYERP visual class tokens that carry `!important` paddings/heights
 * (`.btn`, `.btn.sm`, `.card`, `.form-input`…). They must never reach a
 * Tailwind-styled Marketing primitive, otherwise h-9 / px-* are silently discarded.
 */
const LEGACY_TOKENS = new Set([
    'btn',
    'primary',
    'secondary',
    'outline',
    'ghost',
    'danger',
    'success',
    'sm',
    'lg',
    'card',
    'form-input',
    'filter-search',
    'pagination',
    'responsive-pagination',
]);

export const stripLegacyClasses = (className?: string): string =>
    (className || '')
        .split(/\s+/)
        .filter(token => token && !LEGACY_TOKENS.has(token))
        .join(' ');

