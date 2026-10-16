// components/templates/EmailEditor/utils/styleUtils.ts
import { EmailBlockStyle } from '../../../../types';

/**
 * Sanitizes border-radius to ensure consistent pixel formatting.
 * Handles single values "10px" and multiple values "10px 20px 30px 40px".
 */
export const sanitizeRadius = (val: string | number | undefined): string => {
    if (val === undefined || val === null || val === '') return '';
    const cleaned = String(val).replace(/px/g, '').trim();
    if (!cleaned) return '';
    const values = cleaned.split(/\s+/).filter(v => v);
    return values.map(v => `${v}px`).join(' ');
};

/**
 * Normalizes numeric strings or numbers into a pixel string.
 */
export const toPx = (val: string | number | undefined, defaultVal = '0px'): string => {
    if (val === undefined || val === null || val === '') return defaultVal;
    if (typeof val === 'number') return `${val}px`;
    const sVal = String(val).trim();
    if (sVal === 'auto' || sVal.endsWith('%') || sVal.endsWith('px')) return sVal;
    return `${sVal}px`;
};

export const fromPx = (val: string | number | undefined): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    return parseInt(String(val).replace('px', '')) || 0;
};

/**
 * Generates a CSS style object or string based on EmailBlockStyle.
 * This is the "Source of Truth" for padding/margin rendering.
 */
export const getPaddingStyle = (s: Partial<EmailBlockStyle>) => {
    return {
        paddingTop: toPx(s.paddingTop),
        paddingRight: toPx(s.paddingRight),
        paddingBottom: toPx(s.paddingBottom),
        paddingLeft: toPx(s.paddingLeft),
    };
};

export const getMarginStyle = (s: Partial<EmailBlockStyle>) => {
    return {
        marginTop: toPx(s.marginTop),
        marginRight: toPx(s.marginRight),
        marginBottom: toPx(s.marginBottom),
        marginLeft: toPx(s.marginLeft),
    };
};

/**
 * Sanitizes line-height: if it has "px" and the numeric part is < 10, it is treated as a unitless value.
 */
export const sanitizeLineHeight = (val: string | number | undefined): string | number | undefined => {
    if (val === undefined || val === null || val === '') return val;
    const sVal = String(val).trim();
    if (sVal.toLowerCase().endsWith('px')) {
        const num = parseFloat(sVal);
        if (!isNaN(num) && num < 10) {
            return num; // strip 'px'
        }
    }
    return val;
};

/**
 * Sanitizes inline styles in HTML, specifically replacing line-height values under 10 ending in px (e.g. line-height: 1.5px)
 * with their unitless equivalent (e.g. line-height: 1.5).
 */
export const sanitizeHtmlLineHeight = (html: string | undefined): string => {
    if (!html) return '';
    // Match line-height: Xpx where X is a float/integer, case-insensitive
    return html.replace(/line-height\s*:\s*([0-9.]+)\s*px/gi, (match, val) => {
        const num = parseFloat(val);
        if (!isNaN(num) && num < 10) {
            return `line-height: ${num}`;
        }
        return match;
    });
};

