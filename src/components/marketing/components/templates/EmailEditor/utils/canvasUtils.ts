// components/templates/EmailEditor/utils/canvasUtils.ts
import React from 'react';
import { EmailBlockStyle } from '../../../../types';
import { toPx, sanitizeRadius, sanitizeLineHeight } from './styleUtils';

// Builds CSSProperties from an EmailBlockStyle object, considering mobile overrides
export const buildCss = (s: EmailBlockStyle, viewMode: 'desktop' | 'mobile', bodyFontFamily: string, type?: string): React.CSSProperties => {
    const isMobile = viewMode === 'mobile';
    const mobileStyles = s.mobile || {};
    const rs = isMobile ? { ...s, ...mobileStyles } : s;

    // Apply mobile-specific defaults if not explicitly set in either desktop or mobile style
    const getMobileDefault = (prop: keyof EmailBlockStyle, defaultVal: string) => {
        if (!isMobile) return toPx(rs[prop] as string | number | undefined);
        // If the property is explicitly set (even to '0' or '0px') in either desktop or mobile, respect it
        const isExplicit = (s[prop] !== undefined && s[prop] !== '') || (mobileStyles[prop] !== undefined && mobileStyles[prop] !== '');
        return isExplicit ? toPx(rs[prop] as string | number | undefined) : defaultVal;
    };

    const paddingTop = type === 'section' ? getMobileDefault('paddingTop', '10px') : toPx(rs.paddingTop);
    const paddingBottom = type === 'section' ? getMobileDefault('paddingBottom', '10px') : toPx(rs.paddingBottom);
    const paddingLeft = type === 'column' ? getMobileDefault('paddingLeft', '10px') : toPx(rs.paddingLeft);
    const paddingRight = type === 'column' ? getMobileDefault('paddingRight', '10px') : toPx(rs.paddingRight);
    
    // Column bottom margin for stacking
    const marginBottom = (type === 'column' && isMobile && !(s as any).noStack) ? getMobileDefault('marginBottom', '20px') : toPx(rs.marginBottom);

    const marginLeft = rs.marginLeft === 'auto' ? 'auto' : toPx(rs.marginLeft);
    const marginRight = rs.marginRight === 'auto' ? 'auto' : toPx(rs.marginRight);

    // Prioritize backgroundImage (gradients) in CSS
    const background = rs.backgroundImage && rs.backgroundImage !== 'none'
        ? rs.backgroundImage
        : rs.backgroundColor;

    return {
        paddingTop, paddingRight, paddingBottom, paddingLeft,
        marginTop: toPx(rs.marginTop), 
        marginRight: marginRight, 
        marginBottom, 
        marginLeft: marginLeft,
        background: background,
        backgroundColor: rs.backgroundColor,
        backgroundImage: rs.backgroundImage,
        backgroundSize: rs.backgroundSize || 'cover',
        backgroundPosition: rs.backgroundPosition || 'center',
        backgroundRepeat: rs.backgroundRepeat || 'no-repeat',
        color: rs.color,
        fontSize: rs.fontSize ? toPx(rs.fontSize) : undefined,
        fontWeight: rs.fontWeight,
        // ✅ FIX: Ưu tiên rs.fontFamily (block setting), fallback về body font
        fontFamily: rs.fontFamily || bodyFontFamily || 'Arial, sans-serif',
        textAlign: rs.textAlign as any,
        lineHeight: sanitizeLineHeight(rs.lineHeight),
        borderStyle: rs.borderStyle as any,
        borderColor: rs.borderColor,
        borderTopWidth: toPx(rs.borderTopWidth),
        borderRightWidth: toPx(rs.borderRightWidth),
        borderBottomWidth: toPx(rs.borderBottomWidth),
        borderLeftWidth: toPx(rs.borderLeftWidth),
        borderRadius: sanitizeRadius(rs.borderRadius),
        borderTopLeftRadius: sanitizeRadius(rs.borderTopLeftRadius),
        borderTopRightRadius: sanitizeRadius(rs.borderTopRightRadius),
        borderBottomLeftRadius: sanitizeRadius(rs.borderBottomLeftRadius),
        borderBottomRightRadius: sanitizeRadius(rs.borderBottomRightRadius),
        width: rs.width,
        height: rs.height,
        maxWidth: (rs as any).maxWidth,
        verticalAlign: rs.verticalAlign as any,
        display: rs.display,
        letterSpacing: rs.letterSpacing,
        fontStyle: rs.fontStyle as any,
        textDecoration: rs.textDecoration,
        textTransform: rs.textTransform as any,
        boxShadow: (rs as any).boxShadow,

        // Custom Block Properties
        checkIconColor: (rs as any).checkIconColor,
        checkIconSize: (rs as any).checkIconSize,
        checkIcon: (rs as any).checkIcon,
        checkTitleFont: (rs as any).checkTitleFont,
        checkTitleColor: (rs as any).checkTitleColor,
        checkTitleSize: (rs as any).checkTitleSize,
        checkItemSize: (rs as any).checkItemSize,
        checkDescColor: (rs as any).checkDescColor,
        checkIconMode: (rs as any).checkIconMode,
        checkCustomIconUrl: (rs as any).checkCustomIconUrl,
        showCheckListTitle: (rs as any).showCheckListTitle,
        showItemTitle: (rs as any).showItemTitle,
        showItemDescription: (rs as any).showItemDescription,
        checkIndividualIcons: (rs as any).checkIndividualIcons,
        checkIconVerticalAlign: (rs as any).checkIconVerticalAlign,
        checkItemColor: (rs as any).checkItemColor,
        checkIconBackgroundColor: (rs as any).checkIconBackgroundColor,
        checkIconRadius: (rs as any).checkIconRadius,
        checkIconBorderWidth: (rs as any).checkIconBorderWidth,
        checkIconBorderColor: (rs as any).checkIconBorderColor,
        checkIconPadding: (rs as any).checkIconPadding,
        playButtonColor: (rs as any).playButtonColor,
        timelineDotColor: (rs as any).timelineDotColor,
        timelineLineColor: (rs as any).timelineLineColor,
        timelineLineStyle: (rs as any).timelineLineStyle,
        timelineDotShape: (rs as any).timelineDotShape,
        starSize: (rs as any).starSize,
        starColor: (rs as any).starColor,
        overlayColor: (rs as any).overlayColor,
        overlayOpacity: (rs as any).overlayOpacity,
        iconColor: (rs as any).iconColor,
        iconBackgroundColor: (rs as any).iconBackgroundColor,
        iconSize: (rs as any).iconSize,
        iconMode: (rs as any).iconMode,
        gap: (rs as any).gap,
        contentBackgroundColor: (rs as any).contentBackgroundColor,
        targetDate: (rs as any).targetDate,
        labelColor: (rs as any).labelColor,
    } as any;
};
