import { API_BASE_URL, EXTERNAL_API_BASE } from '../../../../utils/config';
import { EmailBlock, EmailBodyStyle, EmailBlockStyle } from '../../../../types';
import { SHARED_EMAIL_CSS } from '../constants/editorStyles';
import { fromPx, sanitizeRadius, toPx, sanitizeLineHeight, sanitizeHtmlLineHeight } from './styleUtils';

const CHECKLIST_SVGS: Record<string, string> = {
    CheckCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
    CircleCheckBig: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="m9 11 3 3 7-7"></path>',
    Check: '<path d="M20 6 9 17l-5-5"></path>',
    Star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
    ArrowRight: '<path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>',
    MousePointer2: '<path d="m4 4 7.07 17 2.51-7.39L21 11.07z"></path><path d="m13 13 3 3"></path>',
    Sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path>',
    Heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>',
    Zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"></path>',
    Target: '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>',
    ShoppingBag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path>',
    Package: '<path d="M16.5 9.4 7.55 4.24"></path><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><line x1="12" y1="22" x2="12" y2="12"></line>',
    Settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.72V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.17a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>'
};

const getSVGIcon = (path: string, size: number, color: string) => {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; width: ${size}px; height: ${size}px;">${path}</svg>`;
};

export const getIconUrl = (iconName: string, color: string) => {
    const cleanColor = color.replace('#', '');
    const iconMap: Record<string, string> = {
        facebook: 'facebook-new',
        twitter: 'twitter',
        instagram: 'instagram-new',
        linkedin: 'linkedin',
        youtube: 'youtube-play',
        website: 'globe',
        email: 'mail',
        phone: 'phone',
        tiktok: 'tiktok',
        github: 'github',
        address: 'map-pin',
        CheckCircle: 'checked',
        CircleCheckBig: 'checklist',
        Check: 'ok',
        Star: 'star',
        ArrowRight: 'right',
        MousePointer2: 'cursor',
        Sparkles: 'sparkling',
        Heart: 'like',
        Zap: 'lightning-bolt',
        Target: 'goal',
        ShoppingBag: 'shopping-bag',
        Package: 'box',
        Settings: 'settings',
        ThumbsUp: 'thumb-up',
        Shield: 'shield',
        Award: 'medal',
        Gift: 'gift',
        User: 'user',
        Home: 'home',
        Calendar: 'calendar',
        Clock: 'clock',
        Lock: 'lock',
        MapPin: 'map-pin',
        Phone: 'phone',
        Mail: 'mail',
        Globe: 'globe',
        Bell: 'bell',
        Users: 'groups',
        Search: 'search',
        Menu: 'menu',
        Camera: 'camera',
        Video: 'video',
        Music: 'music',
        File: 'file',
        Folder: 'folder',
        Trash: 'trash',
        Edit: 'edit',
        Plus: 'plus',
        Minus: 'minus',
        X: 'multiply',
        Info: 'info',
        Help: 'help',
        Alert: 'error'
    };
    const tag = iconMap[iconName] || 'ok';
    return `https://img.icons8.com/ios-filled/${(tag === 'twitter' || tag === 'star') ? '50' : '100'}/${cleanColor}/${tag}.png`;
};

export const compileHTML = (blocks: EmailBlock[], bodyStyle: EmailBodyStyle, title: string, options: { isPreview?: boolean } = {}) => {
    const { isPreview = false } = options;
    const responsiveRules: string[] = [];
    const camelToKebab = (str: string) => str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

    const googleFonts = ['Roboto', 'Inter', 'Montserrat', 'Poppins', 'Playfair Display', 'Outfit', 'Nunito', 'Merriweather'];
    const fontsToImport = new Set<string>();
    
    // Scan body font
    const bodyFontMatch = bodyStyle.fontFamily?.match(/'?([^',]+)'?/);
    if (bodyFontMatch && googleFonts.includes(bodyFontMatch[1])) {
        fontsToImport.add(bodyFontMatch[1]);
    }
    
    // Scan block fonts
    const scanBlocksForFonts = (items: EmailBlock[]) => {
        items.forEach(b => {
            if (b.style?.fontFamily) {
                const match = b.style.fontFamily.match(/'?([^',]+)'?/);
                if (match && googleFonts.includes(match[1])) {
                    fontsToImport.add(match[1]);
                }
            }
            if (b.children) scanBlocksForFonts(b.children);
        });
    };
    scanBlocksForFonts(blocks);

    let fontImportsHtml = '';
    let fontImportsCss = '';
    if (fontsToImport.size > 0) {
        fontImportsHtml += `        <link rel="preconnect" href="https://fonts.googleapis.com">\n`;
        fontImportsHtml += `        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n`;
        const fontParams = Array.from(fontsToImport).map(f => `family=${f.replace(/\s+/g, '+')}:ital,wght@0,300;0,400;0,500;0,700;0,900;1,300;1,400;1,500;1,700;1,900`).join('&');
        fontImportsHtml += `        <link href="https://fonts.googleapis.com/css2?${fontParams}&display=swap" rel="stylesheet">`;
        fontImportsCss += `@import url('https://fonts.googleapis.com/css2?${fontParams}&display=swap');`;
    } else {
        fontImportsHtml = `        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n        <link href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet">`;
        fontImportsCss = `@import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap');`;
    }

    const getHeadCss = (customRules: string[]) => `
        ${fontImportsHtml}
        <style type="text/css">
            ${fontImportsCss}
        
        ${SHARED_EMAIL_CSS}
        a { color: ${bodyStyle.linkColor || '#2563eb'} !important; text-decoration: underline !important; }
        .btn-link { text-decoration: none !important; }
        p, h1, h2, h3, h4, h5, h6 { margin: 0; padding: 0; }
        
        @media screen and (max-width: 600px) {
            .full-width { width: 100% !important; }
            .email-container {
                width: 100% !important;
                max-width: 100% !important;
                min-width: 100% !important;
                margin: 0 auto !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
            }
            .section-wrapper { 
                width: 100% !important;
                max-width: 100% !important;
                box-sizing: border-box !important;
                padding-top: 4px !important; 
                padding-bottom: 4px !important; 
                padding-left: 4px !important;
                padding-right: 4px !important;
            }
            .section-content {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 auto !important;
                box-sizing: border-box !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
            }
            .row-resp { 
                display: table !important; 
                width: 100% !important; 
                max-width: 100% !important; 
                margin: 0 auto !important;
                box-sizing: border-box !important;
            }
            .col-resp { 
                display: block !important; 
                width: 100% !important; 
                min-width: 100% !important; 
                max-width: 100% !important; 
                /* Compact safety padding for stacked columns on mobile */
                padding-left: 4px !important; 
                padding-right: 4px !important; 
                padding-top: 2px !important;
                padding-bottom: 2px !important;
                margin-bottom: 10px !important; 
                margin-left: auto !important; 
                margin-right: auto !important;
                box-sizing: border-box !important;
                clear: both !important;
            }
            .col-resp:last-child { margin-bottom: 0 !important; }
            .email-container table {
                box-sizing: border-box !important;
            }
            .timeline-date {
                width: 50px !important;
                padding-right: 6px !important;
                font-size: 11px !important;
            }
            .btn-nostack { 
                font-size: 10px !important; 
            }
            .btn-nostack a {
                padding: 6px 10px !important;
                font-size: 10px !important;
            }
            h1 { font-size: 24px !important; }
            h2 { font-size: 20px !important; }
            
            .image-block img {
                height: auto !important;
                max-width: 100% !important;
            }
            .image-block img.full-width {
                width: 100% !important;
            }
            img.icon-img {
                width: auto !important;
                max-width: none !important;
                height: auto !important;
            }
            .text-block, .quote-block {
                padding-left: 4px !important;
                padding-right: 4px !important;
                padding-top: 4px !important;
                padding-bottom: 4px !important;
            }
            .image-block {
                padding-left: 0 !important;
                padding-right: 0 !important;
                padding-top: 4px !important;
                padding-bottom: 4px !important;
            }
            .mobile-padding-y {
                padding-top: 4px !important;
                padding-bottom: 4px !important;
            }
            .center-on-narrow {
                text-align: center !important;
                display: block !important;
                margin: 0 auto !important;
                float: none !important;
            }
            .mobile-hide { display: none !important; }
            
            /* Responsive Overrides from Block Settings */
            ${customRules.join('\n            ')}
        }
        </style>
    `;

    const getBackgroundStyle = (styleObj: EmailBlockStyle | EmailBodyStyle): string => {
        let style = '';
        const overlayColor = (styleObj as any).overlayColor;
        const overlayOpacity = (styleObj as any).overlayOpacity ?? 0;
        let bgImage = styleObj.backgroundImage || '';

        if (overlayColor && overlayOpacity > 0) {
            const hexToRgba = (hex: string, alpha: number) => {
                let r = 0, g = 0, b = 0;
                if (hex.length === 4) {
                    r = parseInt(hex[1] + hex[1], 16);
                    g = parseInt(hex[2] + hex[2], 16);
                    b = parseInt(hex[3] + hex[3], 16);
                } else if (hex.length === 7) {
                    r = parseInt(hex.slice(1, 3), 16);
                    g = parseInt(hex.slice(3, 5), 16);
                    b = parseInt(hex.slice(5, 7), 16);
                }
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            };
            const rgba = hexToRgba(overlayColor, overlayOpacity);
            if (bgImage && bgImage !== 'none') {
                bgImage = `linear-gradient(${rgba}, ${rgba}), ${bgImage}`;
            }
        }

        if (bgImage && bgImage.includes('gradient')) {
            style += `background: ${bgImage}; `;
            const match = bgImage.match(/linear-gradient\((?:to\s+\w+|[\d.]+deg),\s*(#[\da-fA-F]{3,6}|rgba?\([^)]+\))\s*,/i);
            if (match && match[1]) style += `background-color: ${match[1]}; `; 
        } else if (bgImage && bgImage !== 'none') {
            style += `background-image: url('${bgImage.replace(/url\(['"]?(.+?)['"]?\)/, '$1')}'); background-repeat: ${styleObj.backgroundRepeat || 'no-repeat'}; background-size: ${styleObj.backgroundSize || 'cover'}; background-position: ${styleObj.backgroundPosition || 'center'};`;
        }

        if (styleObj.backgroundColor && styleObj.backgroundColor !== 'transparent') {
            style += `background-color: ${styleObj.backgroundColor}; `;
        }
        return style;
    };

    const getBgColorHtmlAttr = (styleObj: EmailBlockStyle | EmailBodyStyle): string => {
        if (styleObj.backgroundColor && styleObj.backgroundColor !== 'transparent' && !styleObj.backgroundColor.includes('gradient')) {
            return `bgcolor="${styleObj.backgroundColor}"`;
        }
        return '';
    };

    const renderBlock = (b: EmailBlock, parentAlign: string = 'center', parentNoStack: boolean = false): string => {
        const rawStyle = b.style || {};
        const s = { ...rawStyle, lineHeight: sanitizeLineHeight(rawStyle.lineHeight) } as EmailBlockStyle;

        // Custom mobile style overrides generator
        const cleanId = b.id.replace(/[^a-zA-Z0-9]/g, '');
        const customClassName = `el-${cleanId}`;
        const mob = { ...(rawStyle.mobile || {}) };
        let hasMobileOverrides = false;
        let mobileCssRule = '';

        // Handle hideOnMobile
        if (rawStyle.hideOnMobile) {
            mob.display = 'none';
        }

        Object.entries(mob).forEach(([key, val]) => {
            if (val !== undefined && val !== null && val !== '') {
                hasMobileOverrides = true;
                let cssVal = val;
                if (['fontSize', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'marginTop', 'marginBottom', 'width', 'height'].includes(key)) {
                    cssVal = toPx(val as string | number);
                } else if (key === 'borderRadius') {
                    cssVal = sanitizeRadius(val as string);
                }
                mobileCssRule += `${camelToKebab(key)}: ${cssVal} !important; `;
            }
        });

        // Handle hideOnDesktop
        if (rawStyle.hideOnDesktop) {
            hasMobileOverrides = true;
            mobileCssRule += 'display: block !important; max-height: none !important; overflow: visible !important; ';
        }

        if (hasMobileOverrides) {
            responsiveRules.push(`.${customClassName} { ${mobileCssRule} }`);
        }

        const hideOnDesktopCss = rawStyle.hideOnDesktop
            ? 'display: none; max-height: 0px; overflow: hidden; mso-hide: all;'
            : '';

        const getBorderStyle = (styleObj: EmailBlockStyle) => {
            if (!styleObj.borderTopWidth && !styleObj.borderRightWidth && !styleObj.borderBottomWidth && !styleObj.borderLeftWidth) return '';
            return `border-top: ${toPx(styleObj.borderTopWidth) || '0'} ${styleObj.borderStyle || 'solid'} ${styleObj.borderColor || '#dddddd'}; border-right: ${toPx(styleObj.borderRightWidth) || '0'} ${styleObj.borderStyle || 'solid'} ${styleObj.borderColor || '#dddddd'}; border-bottom: ${toPx(styleObj.borderBottomWidth) || '0'} ${styleObj.borderStyle || 'solid'} ${styleObj.borderColor || '#dddddd'}; border-left: ${toPx(styleObj.borderLeftWidth) || '0'} ${styleObj.borderStyle || 'solid'} ${styleObj.borderColor || '#dddddd'};`;
        };

        const paddingCss = `padding: ${toPx(s.paddingTop)} ${toPx(s.paddingRight)} ${toPx(s.paddingBottom)} ${toPx(s.paddingLeft)};`;
        const marginCss = `margin: ${toPx(s.marginTop)} ${toPx(s.marginRight)} ${toPx(s.marginBottom)} ${toPx(s.marginLeft)};`;

        // Alignment logic: use own if specified, else parent
        const align = s.textAlign || parentAlign || 'left';

        const fontFamily = bodyStyle.fontFamily || "'Roboto', Arial, sans-serif";
        const commonStyle = `font-family: ${fontFamily}; color: ${s.color || 'inherit'}; text-align: ${align}; font-weight: ${s.fontWeight || 'normal'}; font-style: ${s.fontStyle || 'normal'}; text-decoration: ${s.textDecoration || 'none'}; text-transform: ${s.textTransform || 'none'};`;
        const radiusStyle = s.borderRadius ? `border-radius: ${sanitizeRadius(s.borderRadius)};` : '';

        const wrapWithMargin = (innerTdHtml: string): string => {
            const hasMargin = [s.marginTop, s.marginBottom, s.marginLeft, s.marginRight].some(m => m && m !== '0' && m !== '0px' && m !== 'auto');
            if (hasMargin) {
                return `<tr><td style="padding: 0;"><table class="${customClassName}" role="presentation" border="0" cellspacing="0" cellpadding="0" style="width: 100%; ${marginCss} ${hideOnDesktopCss}"><tr>${innerTdHtml}</tr></table></td></tr>`;
            }
            return `<tr>${innerTdHtml}</tr>`;
        };

        if (b.type === 'section') {
            const innerBgStyleObj = { backgroundColor: s.contentBackgroundColor };
            const innerBgCss = getBackgroundStyle(innerBgStyleObj);
            const childrenHtml = b.children?.map(c => renderBlock(c, align, parentNoStack).trim()).join('') || '';
            const sectionMarginTop = s.marginTop || '0px';
            const sectionMarginBottom = s.marginBottom || '0px';
            // [FIX] Apply marginTop/Bottom via wrapper table cellspacing trick (margin on td is ignored by Outlook/Gmail)
            // We use separate spacer rows before/after the section content for cross-client margin support
            const topSpacer = sectionMarginTop !== '0px' && sectionMarginTop !== '0' ? `<tr><td height="${parseInt(sectionMarginTop)||0}" style="font-size: ${parseInt(sectionMarginTop)||0}px; line-height: ${parseInt(sectionMarginTop)||0}px; mso-line-height-rule: exactly;">&nbsp;</td></tr>` : '';
            const bottomSpacer = sectionMarginBottom !== '0px' && sectionMarginBottom !== '0' ? `<tr><td height="${parseInt(sectionMarginBottom)||0}" style="font-size: ${parseInt(sectionMarginBottom)||0}px; line-height: ${parseInt(sectionMarginBottom)||0}px; mso-line-height-rule: exactly;">&nbsp;</td></tr>` : '';
            return `${topSpacer}<tr><td align="center" valign="top" class="section-wrapper ${customClassName}" ${getBgColorHtmlAttr(s)} style="${getBackgroundStyle(s)} ${paddingCss} ${radiusStyle} ${getBorderStyle(s)} ${hideOnDesktopCss}"><table class="full-width section-content" role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" align="center" style="max-width: ${bodyStyle.contentWidth}; ${innerBgCss}; margin: 0 auto;"><tbody>${childrenHtml}</tbody></table></td></tr>${bottomSpacer}`;
        }

        if (b.type === 'row') {
            const noStack = s.noStack === true;
            const rowGap = parseInt(String(s.gap || 0)) || 0;
            const halfGap = rowGap / 2;

            const columnsHtml = (b.children || []).map(col => {
                const cs = col.style || {};
                const width = cs.width || '100%';
                const colRadius = cs.borderRadius ? `border-radius: ${sanitizeRadius(cs.borderRadius)};` : '';
                const textAlign = cs.textAlign || align; 
                const colClass = noStack ? "" : "col-resp";
                const colBorderStyle = getBorderStyle(cs);
                const colChildrenHtml = col.children?.map(c => renderBlock(c, textAlign, noStack).trim()).join('') || '';
                
                // Add gap padding to existing padding
                const pTop = toPx(cs.paddingTop);
                const pRight = toPx(fromPx(cs.paddingRight as string) + halfGap);
                const pBottom = toPx(cs.paddingBottom);
                const pLeft = toPx(fromPx(cs.paddingLeft as string) + halfGap);
                
                const colPadding = `padding: ${pTop} ${pRight} ${pBottom} ${pLeft};`;
                const widthAttr = width.includes('%') ? width : width.replace('px', '');

                const colCleanId = col.id.replace(/[^a-zA-Z0-9]/g, '');
                const colCustomClassName = `el-${colCleanId}`;

                // Process column-specific mobile overrides
                const colMob = cs.mobile || {};
                let colHasMobileOverrides = false;
                let colMobileCssRule = '';
                Object.entries(colMob).forEach(([key, val]) => {
                    if (val !== undefined && val !== null && val !== '') {
                        colHasMobileOverrides = true;
                        let cssVal = val;
                        if (['fontSize', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'marginTop', 'marginBottom', 'width', 'height'].includes(key)) {
                            cssVal = toPx(val as string | number);
                        } else if (key === 'borderRadius') {
                            cssVal = sanitizeRadius(val as string);
                        }
                        colMobileCssRule += `${camelToKebab(key)}: ${cssVal} !important; `;
                    }
                });
                if (colHasMobileOverrides) {
                    responsiveRules.push(`.${colCustomClassName} { ${colMobileCssRule} }`);
                }

                return `<td class="${colClass} ${colCustomClassName}" align="${textAlign}" valign="${cs.verticalAlign || 'top'}" width="${widthAttr}" ${getBgColorHtmlAttr(cs)} style="width:${width}; ${colPadding} text-align: ${textAlign}; ${getBackgroundStyle(cs)} ${colBorderStyle} ${colRadius} overflow: hidden;"><table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" align="${textAlign}"><tbody>${colChildrenHtml}</tbody></table></td>`;
            }).join('');
            const rowClass = noStack ? "" : "row-resp";
            const rowWidth = s.width || '100%';
            const rowWidthHtml = typeof rowWidth === 'string' && rowWidth.includes('%') ? rowWidth : String(rowWidth).replace('px', '');
            const rowAlign = s.textAlign || 'center';
            const marginLeft = (s.marginLeft && s.marginLeft !== '0px' && s.marginLeft !== '0') ? s.marginLeft : (rowAlign === 'center' ? 'auto' : (rowAlign === 'right' ? 'auto' : '0px'));
            const marginRight = (s.marginRight && s.marginRight !== '0px' && s.marginRight !== '0') ? s.marginRight : (rowAlign === 'center' ? 'auto' : (rowAlign === 'left' ? 'auto' : '0px'));
            const rowMargin = `margin-top: 0px; margin-bottom: 0px; margin-left: ${marginLeft}; margin-right: ${marginRight};`;
            return wrapWithMargin(`<td align="${rowAlign}" class="${customClassName}" style="${paddingCss} ${getBackgroundStyle(s)} ${radiusStyle} ${getBorderStyle(s)} ${hideOnDesktopCss} width: 100%;"><table class="${rowClass}" role="presentation" border="0" cellspacing="0" cellpadding="0" width="${rowWidthHtml}" align="${rowAlign}" style="width: ${rowWidth}; ${rowMargin} overflow: hidden; border-collapse: collapse;"><tr>${columnsHtml}</tr></table></td>`);
        }

        if (b.type === 'button') {
            const btnBg = s.contentBackgroundColor || (s as any).buttonBackgroundColor || s.backgroundColor || '#d97706';
            const btnWidth = s.width || 'auto';
            const tableWidthAttr = (btnWidth && btnWidth !== 'auto') ? `width="${btnWidth.replace('px', '')}"` : '';
            const inlineWidth = btnWidth === 'auto' ? '' : `width: ${btnWidth};`;
            const btnColor = s.color || '#ffffff';
            const btnPadding = `padding: ${s.paddingTop || '12px'} ${s.paddingRight || '24px'} ${s.paddingBottom || '12px'} ${s.paddingLeft || '24px'};`;
            // Use inherited alignment if not explicitly set (default to center to match canvas editor)
            const btnAlign = s.textAlign || 'center';
            const btnMarginTop = s.marginTop || '0px';
            const btnMarginBottom = s.marginBottom || '0px';
            const btnMarginLeft = (btnAlign === 'center' || btnAlign === 'right') ? 'auto' : (s.marginLeft || '0px');
            const btnMarginRight = (btnAlign === 'center' || btnAlign === 'left') ? 'auto' : (s.marginRight || '0px');

            // Use global sanitizeRadius utility
            const btnRadius = sanitizeRadius(s.borderRadius || '4px');
            const btnHeight = s.height ? `height: ${s.height}; ` : '';
            const btnLineHeight = s.lineHeight ? `line-height: ${s.lineHeight}; ` : '';

            const tableMarginCss = `margin-top: ${btnMarginTop}; margin-bottom: ${btnMarginBottom}; margin-left: ${btnMarginLeft}; margin-right: ${btnMarginRight};`;
            const normalizeBlockLink = (raw?: string) => {
                const u = (raw || '').trim();
                if (!u || u === '#') return '#';
                if (/^(?:https?:\/\/|mailto:|tel:|#|\/|\{\{)/i.test(u)) return u;
                if (u.startsWith('//')) return 'https:' + u;
                if (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(u)) return 'https://' + u;
                return u;
            };
            const btnHref = normalizeBlockLink(b.url);
            const dataFallbackAttr = b.fallbackUrl ? ` data-fallback-url="${normalizeBlockLink(b.fallbackUrl)}"` : '';

            return `<tr><td align="${btnAlign}" class="${customClassName}" style="width: 100%; text-align: ${btnAlign} !important; ${hideOnDesktopCss}"><!--[if mso]><table role="presentation" border="0" cellspacing="0" cellpadding="0" align="${btnAlign}" ${tableWidthAttr} style="${tableMarginCss} ${inlineWidth}"><tr><td align="center" style="background: ${btnBg}; border-radius: ${btnRadius};"><![endif]--><!--[if !mso]><!--><table border="0" cellspacing="0" cellpadding="0" align="${btnAlign}" ${tableWidthAttr} style="${tableMarginCss} display: table; border-collapse: separate; ${inlineWidth}"><!--<![endif]--><tr><td align="center" class="${parentNoStack ? 'btn-nostack' : ''}" style="${getBorderStyle(s)} border-radius: ${btnRadius};"><a class="btn-link ${customClassName} ${parentNoStack ? 'btn-nostack' : ''}" href="${btnHref}"${dataFallbackAttr} target="_blank" style="font-family: ${bodyStyle.fontFamily || "'Roboto', Arial, sans-serif"}; font-size: ${s.fontSize || '16px'}; font-weight: ${s.fontWeight || 'bold'}; font-style: ${s.fontStyle || 'normal'}; text-decoration: ${s.textDecoration || 'none'}; text-transform: ${s.textTransform || 'none'}; color: ${btnColor} !important; border-radius: ${btnRadius}; -webkit-border-radius: ${btnRadius}; -moz-border-radius: ${btnRadius}; ${btnPadding} ${btnHeight}${btnLineHeight}display: block; background: ${btnBg}; ${inlineWidth} box-sizing: border-box; text-align: center; overflow: hidden;">${b.content || 'BUTTON'}</a></td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr>`;
        }

        if (b.type === 'header') {
            const menuType = (s as any).headerMenuType || 'link';
            const menuGap = parseInt((s as any).menuGap || '20px');
            const logoWidth = (s as any).logoWidth || '120px';
            const btnBg = (s as any).buttonBg || '#d97706';
            const btnColor = (s as any).buttonColor || '#ffffff';
            const menuItems = b.items || [];
            
            const menuHtml = menuItems.map((item, i) => {
                const paddingLeft = i === 0 ? 0 : menuGap;
                const rawItemLink = (item.description || '').trim();
                const itemLink = (!rawItemLink || rawItemLink === '#')
                    ? '#'
                    : (/^(?:https?:\/\/|mailto:|tel:|#|\/|\{\{)/i.test(rawItemLink) ? rawItemLink : (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(rawItemLink) ? 'https://' + rawItemLink : rawItemLink));
                const itemType = item.menuType || menuType;
                
                if (itemType === 'button') {
                    return `<td style="padding-left: ${paddingLeft}px; padding-top: 5px; padding-bottom: 5px;"><table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center"><tr><td align="center" bgcolor="${btnBg}" style="border-radius: 6px; padding: 8px 16px;"><a href="${itemLink}" target="_blank" style="font-family: ${fontFamily}; font-size: 13px; font-weight: bold; color: ${btnColor} !important; text-decoration: none; display: block;">${item.title}</a></td></tr></table></td>`;
                } else {
                    return `<td style="padding-left: ${paddingLeft}px; padding-top: 5px; padding-bottom: 5px;"><a href="${itemLink}" target="_blank" style="font-family: ${fontFamily}; font-size: 14px; font-weight: 600; color: ${s.color || '#475569'} !important; text-decoration: none;">${item.title}</a></td>`;
                }
            }).join('');

            return wrapWithMargin(`
                <td align="center" class="${customClassName}" style="${paddingCss} ${getBackgroundStyle(s)} ${radiusStyle} ${getBorderStyle(s)} ${hideOnDesktopCss}">
                    <!--[if mso]><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td width="30%" align="left" valign="middle"><![endif]-->
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                        <tr>
                            <!-- Logo Column -->
                            <td class="col-resp" align="left" valign="middle" style="padding: 0; text-align: left;">
                                <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                                    <tr>
                                        <td align="left" class="center-on-narrow">
                                            <img src="${b.content || 'https://via.placeholder.com/120x40?text=Logo'}" width="${logoWidth.replace('px', '')}" style="display: block; width: ${logoWidth}; max-width: 100%; height: auto; border: 0;" alt="${b.altText || 'Logo'}" />
                                        </td>
                                    </tr>
                                </table>
                            </td>
                            <!--[if mso]></td><td width="70%" align="right" valign="middle"><![endif]-->
                            <!-- Menu Column -->
                            <td class="col-resp" align="right" valign="middle" style="padding: 0; text-align: right;">
                                <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="right" class="center-on-narrow" style="display: inline-table;">
                                    <tr>${menuHtml}</tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                    <!--[if mso]></td></tr></table><![endif]-->
                </td>
            `);
        }

        if (b.type === 'timeline') {
            const dotColor = s.timelineDotColor || '#2563eb';
            const lineColor = s.timelineLineColor || '#e2e8f0';
            const lineStyle = s.timelineLineStyle || 'solid';
            const items = b.items || [];

            return wrapWithMargin(`<td class="${customClassName}" style="${paddingCss} ${getBackgroundStyle(s)} ${radiusStyle} ${getBorderStyle(s)} ${hideOnDesktopCss} overflow: hidden;"><table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="border-collapse: collapse;">${items.map((item, i) => {
                const isFirst = i === 0;
                const isLast = i === items.length - 1;
                const centerPos = '14px';
                const gradStart = isFirst ? centerPos : '0%';
                const gradEnd = isLast ? centerPos : '100%';
                const lineBg = `linear-gradient(to bottom, transparent 0%, transparent ${gradStart}, ${lineColor} ${gradStart}, ${lineColor} ${gradEnd}, transparent ${gradEnd})`;
                const dateWidth = item.date ? 80 : 0;
                return `<tr><td class="timeline-date ${customClassName}" width="${dateWidth}" valign="top" style="padding: 6px ${item.date ? '15' : '0'}px 30px 0; text-align: right; font-family: ${bodyStyle.fontFamily || "'Roboto', Arial, sans-serif"}; font-size: 12px; color: ${s.color || 'inherit'}; width: ${dateWidth}px;"><strong>${sanitizeHtmlLineHeight(item.date || '')}</strong></td><td width="20" valign="top" align="center" style="padding: 0; background: ${lineBg}; background-size: 2px 100%; background-position: center; background-repeat: no-repeat;"><div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${dotColor}; border: 2px solid #ffffff; margin: 6px auto 0; box-sizing: content-box;"></div></td><td class="${customClassName}" valign="top" style="padding: 6px 0 40px 20px; font-family: ${bodyStyle.fontFamily || "'Roboto', Arial, sans-serif"};"><h4 class="${customClassName}" style="margin: 0 0 5px; font-size: 16px; color: ${bodyStyle.fontFamily ? 'inherit' : '#1e293b'}; font-weight: bold; text-align: left;">${sanitizeHtmlLineHeight(item.title || '')}</h4><div class="${customClassName}" style="margin: 0; font-size: 14px; color: #64748b; text-align: left; line-height: 1.5;">${sanitizeHtmlLineHeight(item.description || '')}</div></td></tr>`;
            }).join('')}</table></td>`);
        }

        if (b.type === 'video') {
            const videoAlign = s.textAlign || 'center';
            const playBtnColor = (s.playButtonColor || '#d97706').replace('#', '');
            const radius = sanitizeRadius(s.borderRadius || '12px');
            const rawThumb = b.thumbnailUrl || 'https://via.placeholder.com/600x340?text=Video+Thumbnail';
            // Use server-side composite image generator for 100% email client compatibility (Gmail PC, Gmail Mobile, Outlook)
            const finalThumbSrc = `${EXTERNAL_API_BASE}/video_thumb.php?url=${encodeURIComponent(rawThumb)}&color=${playBtnColor}`;

            return wrapWithMargin(`
                <td align="${videoAlign}" class="video-block ${customClassName}" style="${paddingCss} ${getBackgroundStyle(s)} ${radiusStyle} ${getBorderStyle(s)} ${hideOnDesktopCss}">
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" align="${videoAlign}" style="max-width: 100%; border-collapse: separate; margin: 0 ${videoAlign === 'center' ? 'auto' : (videoAlign === 'right' ? '0 0 auto' : 'auto 0')};">
                        <tr>
                            <td align="${videoAlign}" style="padding: 0;">
                                <a href="${b.videoUrl || '#'}" target="_blank" style="display: block; text-decoration: none; width: 100%; max-width: 100%; border-radius: ${radius}; overflow: hidden;">
                                    <img src="${finalThumbSrc}" width="100%" style="display: block; max-width: 100%; width: 100%; height: auto; border-radius: ${radius}; border: 0;" alt="Video" />
                                </a>
                            </td>
                        </tr>
                    </table>
                </td>
            `);
        }

        if (b.type === 'order_list') {
            const orderListBorder = getBorderStyle(s) || 'border: 1px solid #eeeeee;';
            const orderListPadding = `padding: ${s.paddingTop || '24px'} ${s.paddingRight || '24px'} ${s.paddingBottom || '24px'} ${s.paddingLeft || '24px'};`;
            const orderListBgStyle = getBackgroundStyle(s) || 'background-color: #ffffff;';
            const orderListRadius = sanitizeRadius(s.borderRadius || '16px');
            return wrapWithMargin(`
                    <td align="center" class="${customClassName}" style="padding: 0; ${hideOnDesktopCss}">
                        <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="border-collapse: collapse; border-radius: ${orderListRadius}; ${orderListBorder} ${orderListBgStyle}">
                            <tr>
                                <td style="${orderListPadding}">
                                    <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="border-bottom: 1px solid #f1f5f9; padding-bottom: 15px; margin-bottom: 20px;">
                                        <tr>
                                            <td width="24" valign="middle" style="padding-right: 8px;">
                                                <img src="${getIconUrl('ShoppingBag', '#64748b')}" width="16" height="16" style="display: block; width: 16px; height: 16px;" />
                                            </td>
                                            <td valign="middle" style="font-family: ${bodyStyle.fontFamily || "'Roboto', Arial, sans-serif"}; font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Danh sách sản phẩm</td>
                                        </tr>
                                    </table>
                                    <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                                        ${[1, 2].map(i => `
                                            <tr>
                                                <td width="70" valign="top" style="padding-bottom: 15px;">
                                                    <div style="width: 60px; height: 60px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center;">
                                                        <img src="${getIconUrl('Package', '#cbd5e1')}" width="24" height="24" style="display: block; width: 24px; height: 24px;" />
                                                    </div>
                                                </td>
                                                <td valign="top" style="padding: 0 10px 15px 10px; font-family: ${bodyStyle.fontFamily || "'Roboto', Arial, sans-serif"};">
                                                    <div style="font-size: 14px; font-weight: bold; color: #1e293b; margin-bottom: 4px;">Sản phẩm mẫu #${i}</div>
                                                    <div style="font-size: 12px; color: #64748b; line-height: 1.4;">Chi tiết về sản phẩm này sẽ được hiển thị tại đây. Đây là mẫu thiết kế.</div>
                                                </td>
                                                <td width="80" valign="top" align="right" style="padding-bottom: 15px; font-family: ${bodyStyle.fontFamily || "'Roboto', Arial, sans-serif"};">
                                                    <div style="font-size: 14px; font-weight: bold; color: #2563eb;">$99.00</div>
                                                    <div style="font-size: 11px; color: #94a3b8; text-decoration: line-through;">$149.00</div>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </table>
                                    <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="border-top: 1px solid #f1f5f9; margin-top: 10px; padding-top: 15px;">
                                        <tr>
                                            <td style="font-family: ${bodyStyle.fontFamily || "'Roboto', Arial, sans-serif"}; font-size: 13px; font-weight: bold; color: #1e293b;">TỔNG CỘNG</td>
                                            <td align="right" style="font-family: ${bodyStyle.fontFamily || "'Roboto', Arial, sans-serif"}; font-size: 15px; font-weight: 800; color: #2563eb;">$198.00</td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                `);
        }

        if (b.type === 'countdown') {
            const digitColor = (s.color || '#ffffff').replace('#', '');
            const labelColor = (s.labelColor || '#004a7c').replace('#', '');
            // const targetDate = s.targetDate ? new Date(s.targetDate).getTime() : 0;
            const targetDateStr = s.targetDate || '';
            const bg = 'transparent'; // Future: s.backgroundColor ...

            // Use server-side generated image for email compatibility
            const timerUrl = `${EXTERNAL_API_BASE}/timer.php?target=${encodeURIComponent(targetDateStr)}&color=${digitColor}&bg=${bg}&v=${Date.now()}`;

            return wrapWithMargin(`\n                    <td align="center" class="${customClassName}" style="${paddingCss} ${getBackgroundStyle(s)} ${radiusStyle} ${getBorderStyle(s)} ${hideOnDesktopCss} overflow: hidden;">\n                        <!-- Timer Container -->
                        <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="max-width: 400px;">
                            <tr>
                                <td align="center">
                                    <!-- Numbers Image -->
                                    <img src="${timerUrl}" width="500" style="display: block; max-width: 100%; height: auto; margin: 0 auto;" alt="Countdown Timer" />
                                </td>
                            </tr>
                            <tr>
                                <td align="center" style="padding-top: 4px;">
                                    <!-- Labels Table -->
                                    <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                                        <tr>
                                            <td width="33.33%" align="center" class="${customClassName}" style="font-family: ${bodyStyle.fontFamily || "'Roboto', Arial, sans-serif"}; font-size: 13px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: #${labelColor};">NGÀY</td>
                                            <td width="33.33%" align="center" class="${customClassName}" style="font-family: ${bodyStyle.fontFamily || "'Roboto', Arial, sans-serif"}; font-size: 13px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: #${labelColor};">GIỜ</td>
                                            <td width="33.33%" align="center" class="${customClassName}" style="font-family: ${bodyStyle.fontFamily || "'Roboto', Arial, sans-serif"}; font-size: 13px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: #${labelColor};">PHÚT</td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                                        </td>\n                `);
        }

        if (b.type === 'quote') {
            const paddingVertical = s.paddingTop || '15px';
            const paddingHorizontal = s.paddingLeft || '25px';
            const quoteBorderColor = s.borderColor || '#2563eb';
            const quoteBorderWidth = s.borderLeftWidth || '4px';
            const quoteBorderLeft = `${quoteBorderWidth} ${s.borderStyle || 'solid'} ${quoteBorderColor}`;
            const quoteBorderTop = s.borderTopWidth ? `border-top: ${s.borderTopWidth} ${s.borderStyle || 'solid'} ${quoteBorderColor}; ` : '';
            const quoteBorderRight = s.borderRightWidth ? `border-right: ${s.borderRightWidth} ${s.borderStyle || 'solid'} ${quoteBorderColor}; ` : '';
            const quoteBorderBottom = s.borderBottomWidth ? `border-bottom: ${s.borderBottomWidth} ${s.borderStyle || 'solid'} ${quoteBorderColor}; ` : '';
            // [FIX] Gmail-safe: use table instead of div for quote block, remove double padding by zeroing outer td padding
            return wrapWithMargin(`<td class="quote-block ${customClassName}" style="padding: 0; ${hideOnDesktopCss}"><table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="border-left: ${quoteBorderLeft}; ${quoteBorderTop}${quoteBorderRight}${quoteBorderBottom}border-radius: ${sanitizeRadius(s.borderRadius || '0')}; background-color: ${s.backgroundColor || 'transparent'};"><tr><td class="${customClassName}" style="padding: ${paddingVertical} ${s.paddingRight || '25px'} ${s.paddingBottom || '15px'} ${paddingHorizontal}; font-family: ${bodyStyle.fontFamily || "'Roboto', Arial, sans-serif"}; font-size: ${s.fontSize || '15px'}; font-style: ${s.fontStyle || 'italic'}; line-height: 1.6; color: ${s.color || 'inherit'}; text-align: ${s.textAlign || 'left'}; font-weight: ${s.fontWeight || 'normal'};">${sanitizeHtmlLineHeight(b.content)}</td></tr></table></td>`);
        }

        if (b.type === 'check_list') {
            const checkIconColor = s.checkIconColor || '#d97706';
            const checkIconSize = parseInt(s.checkIconSize || '20');
            const items = b.items || [];
            const showTitle = s.showCheckListTitle !== false;
            const title = b.checkListTitle || 'Checklist';
            const maxW = s.maxWidth ? `max-width: ${s.maxWidth}; margin: 0 auto;` : '';
            
            const titleFont = s.checkTitleFont || fontFamily;
            const titleSize = s.checkTitleSize ? (typeof s.checkTitleSize === 'string' ? s.checkTitleSize : s.checkTitleSize + 'px') : '18px';
            const itemSize = s.checkItemSize ? (typeof s.checkItemSize === 'string' ? s.checkItemSize : s.checkItemSize + 'px') : '14px';
            const descSize = s.checkItemSize ? `${Math.max(10, parseInt(String(s.checkItemSize)) - 1)}px` : '13px';
            const titleColor = s.checkTitleColor || s.color || '#1e293b';
            const itemColor = s.checkItemColor || s.color || '#334155';
            const descColor = s.checkDescColor || '#64748b';
            const vAlignGlobal = s.checkIconVerticalAlign || 'top';

            return wrapWithMargin(`
                    <td class="mobile-padding-y ${customClassName}" style="${paddingCss} ${getBackgroundStyle(s)} border-radius: ${sanitizeRadius(s.borderRadius || '0')}; ${getBorderStyle(s)} ${hideOnDesktopCss} overflow: hidden;">
                        <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="${maxW}">
                        <tbody><tr><td style="text-align: ${s.textAlign || 'left'};">
                        ${showTitle ? `<h3 class="${customClassName}" style="margin: 0 0 15px; font-family: ${titleFont}; font-size: ${titleSize}; font-weight: bold; color: ${titleColor}; text-align: ${s.textAlign || 'left'};">${sanitizeHtmlLineHeight(title)}</h3>` : ''}
                        <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                            ${items.map(item => {
                const showItemTitle = s.showItemTitle !== false;
                const showItemDesc = s.showItemDescription !== false;
                const isSingleLine = !showItemTitle || !showItemDesc;
                const iconPaddingTop = isSingleLine ? '5px' : '6px';
                const textPaddingTop = isSingleLine ? '5px' : '2px';

                // Support custom image OR library icon
                const showIndividual = s.checkIndividualIcons && s.checkIconMode === 'image';
                const iconUrl = (showIndividual && item.customIconUrl)
                    ? item.customIconUrl
                    : (s.checkIconMode === 'image' && s.checkCustomIconUrl)
                        ? s.checkCustomIconUrl
                        : getIconUrl(s.checkIcon || 'CheckCircle', checkIconColor);

                // Style for the icon container
                const iconRadius = sanitizeRadius(s.checkIconRadius || '0');
                const iconBg = s.checkIconBackgroundColor || 'transparent';
                const iconBorder = (parseInt(s.checkIconBorderWidth || '0') > 0) 
                    ? `${s.checkIconBorderWidth} solid ${s.checkIconBorderColor || '#e2e8f0'}` 
                    : 'none';
                const iconPadding = s.checkIconPadding || '0';
                const iconAlign = s.textAlign === 'center' ? 'center' : (s.textAlign === 'right' ? 'right' : 'left');

                return `
                                    <tr>
                                        <td width="${checkIconSize + 10}" valign="${vAlignGlobal}" style="padding: ${vAlignGlobal === 'top' ? iconPaddingTop : '0'} 0 12px 0;">
                                            <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="${iconAlign}" style="background-color: ${iconBg}; border-radius: ${iconRadius}; border: ${iconBorder}; border-collapse: separate;">
                                                <tr>
                                                    <td style="padding: ${iconPadding}; font-size: 0; line-height: 0;">
                                                        <img src="${iconUrl}" width="${checkIconSize}" height="${checkIconSize}" class="icon-img" style="display: block; width: ${checkIconSize}px !important; max-width: ${checkIconSize}px !important; height: ${checkIconSize}px; object-fit: ${s.checkIconMode === 'image' ? 'cover' : 'contain'}; border: 0; border-radius: ${iconRadius};" />
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                        <td valign="${vAlignGlobal}" class="${customClassName}" style="padding: ${textPaddingTop} 0 12px 10px; font-family: ${fontFamily}; text-align: left;">
                                            ${showItemTitle ? `<div class="${customClassName}" style="font-size: ${itemSize}; font-weight: bold; color: ${itemColor}; margin-bottom: ${showItemDesc ? '2' : '0'}px;">${sanitizeHtmlLineHeight(item.title || '')}</div>` : ''}
                                            ${showItemDesc ? `<div class="${customClassName}" style="font-size: ${descSize}; color: ${descColor}; line-height: 1.4;">${sanitizeHtmlLineHeight(item.description || '')}</div>` : ''}
                                        </td>
                                    </tr>
                                `;
            }).join('')}
                        </table>
                        </td></tr></tbody></table>
                    </td>
                `);
        }

        if (b.type === 'table') {
            const tableRows = s.tableRows ?? 3;
            const tableCols = s.tableCols ?? 4;
            const headerRow = s.tableHeaderRow !== false;
            const headerBg = s.tableHeaderBg || '#1e293b';
            const headerTextColor = s.tableHeaderTextColor || '#ffffff';
            const stripe = s.tableStripe || 'alternate';
            const evenBg = s.tableEvenBg || '#f8fafc';
            const oddBg = s.tableOddBg || '#ffffff';
            const solidBg = s.tableSolidBg || '#ffffff';
            const evenColor = s.tableEvenTextColor || '#1e293b';
            const oddColor = s.tableOddTextColor || '#1e293b';
            const borderColor = s.tableBorderColor || '#e2e8f0';
            const borderW = s.tableBorderWidth || '1px';
            const cellPad = s.tableCellPadding || '8px 12px';
            const colWidths: string[] = s.tableColWidths || Array(tableCols).fill('auto');
            const colAligns: string[] = s.tableColAligns || Array(tableCols).fill('left');
            const fontSize = s.tableFontSize || '13px';
            const lastRowBg = s.tableLastRowBg || '';
            const lastRowColor = s.tableLastRowTextColor || '';
            const lastColBg = s.tableLastColBg || '';
            const lastColColor = s.tableLastColTextColor || '';

            let cells: { content: string; align?: string; bg?: string; color?: string }[][] = [];
            try { cells = JSON.parse(b.content); } catch { cells = []; }
            while (cells.length < tableRows) cells.push(Array(tableCols).fill({ content: '', align: 'left' }));

            const borderStyle = `${borderW} solid ${borderColor}`;

            const getCellBg = (ri: number, ci: number): string => {
                if (headerRow && ri === 0) return headerBg;
                const di = headerRow ? ri - 1 : ri;
                let bg = stripe === 'alternate' ? (di % 2 === 0 ? evenBg : oddBg) : solidBg;
                if (ri === tableRows - 1 && lastRowBg) bg = lastRowBg;
                if (ci === tableCols - 1 && lastColBg) bg = lastColBg;
                const cellBg = cells[ri]?.[ci]?.bg;
                if (cellBg) bg = cellBg;
                return bg;
            };

            const getCellColor = (ri: number, ci: number): string => {
                if (headerRow && ri === 0) return headerTextColor;
                const di = headerRow ? ri - 1 : ri;
                let color = stripe === 'alternate' ? (di % 2 === 0 ? evenColor : oddColor) : (s.color || '#1e293b');
                if (ri === tableRows - 1 && lastRowColor) color = lastRowColor;
                if (ci === tableCols - 1 && lastColColor) color = lastColColor;
                const cellColor = cells[ri]?.[ci]?.color;
                if (cellColor) color = cellColor;
                return color;
            };

            // colgroup for widths
            const colgroup = `<colgroup>${Array.from({ length: tableCols }, (_, ci) => {
                const w = colWidths[ci];
                return w && w !== 'auto' ? `<col width="${w.replace('%', '').replace('px', '')}${w.includes('%') ? '%' : ''}" />` : '<col />';
            }).join('')}</colgroup>`;

            const rows = Array.from({ length: tableRows }, (_, ri) => {
                const rowCells = cells[ri] || [];
                const tds = Array.from({ length: tableCols }, (_, ci) => {
                    const cell = rowCells[ci] || { content: '', align: colAligns[ci] || 'left' };
                    const cellAlign = cell.align || colAligns[ci] || 'left';
                    const isHeader = headerRow && ri === 0;
                    const bg = getCellBg(ri, ci);
                    const color = getCellColor(ri, ci);
                    const formattedContent = cell.content || '&nbsp;';
                    return `<td align="${cellAlign}" valign="middle" style="padding: ${cellPad}; border: ${borderStyle}; font-family: ${bodyStyle.fontFamily || "'Roboto', Arial, sans-serif"}; font-size: ${fontSize}; font-weight: ${isHeader ? 'bold' : 'normal'}; color: ${color}; text-align: ${cellAlign}; background-color: ${bg}; white-space: pre-wrap; word-break: break-word;">${formattedContent}</td>`;
                }).join('');
                return `<tr>${tds}</tr>`;
            }).join('');

            return wrapWithMargin(`\n                    <td style="${paddingCss} ${getBackgroundStyle(s)} ${radiusStyle} ${getBorderStyle(s)} overflow: hidden;">\n                        <!--[if mso]><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
                        <div style="overflow-x: auto;">
                        <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="border-collapse: collapse; width: 100%; table-layout: fixed;">
                            ${colgroup}
                            <tbody>${rows}</tbody>
                        </table>
                        </div>
                        <!--[if mso]></td></tr></table><![endif]-->\n                    </td>\n                `).trim();
        }

        if (b.type === 'voucher') {
            const vStyle = s.voucherStyle || 'ticket';
            const vBorderColor = s.voucherBorderColor || '#d97706';
            const vBorderStyle = s.voucherBorderStyle || 'dashed';
            const vBg = s.voucherBg || '#fffbe1';
            const vTextColor = s.voucherTextColor || '#b45309';
            const btnBg = s.voucherButtonBg || '#d97706';
            const btnText = s.voucherButtonTextColor || '#ffffff';
            const linkId = b.voucherCampaignId;
            const codePlaceholder = linkId ? `[VOUCHER_${linkId}]` : 'XXXX-XXXX';
            
            let previewImgUrl = '';
            if (linkId) {
                try {
                    // [FIX BUG-COMPILER-1] localStorage is not available in SSR/Node contexts.
                    // Guard with typeof window to prevent ReferenceError when compileHTML is called server-side.
                    if (typeof window !== 'undefined' && window.localStorage) {
                        const stored = JSON.parse(localStorage.getItem('mailflow_voucher_campaigns') || '[]');
                        const camp = stored.find((c: any) => c.id === linkId);
                        if (camp && camp.rewards && camp.rewards.length > 0) {
                            previewImgUrl = camp.rewards[0].imageUrl || '';
                        }
                    }
                } catch (e) {}
            }

            // We must render standard table-based layouts for email clients
            const innerHtml = `
                <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="background-color: ${vBg}; border: 2px ${vBorderStyle} ${vBorderColor}; border-radius: ${sanitizeRadius(s.borderRadius || '12px')};">
                    <tr>
                        <td align="center" style="padding: 24px; text-align: center; font-family: ${fontFamily};">
                            <!-- Icon / Img -->
                            ${previewImgUrl 
                                ? `<img src="${previewImgUrl}" style="display: block; margin: 0 auto 16px auto; max-height: 120px; max-width: 100%; border-radius: 8px;" alt="Reward" />` 
                                : `<img src="${getIconUrl('Gift', vBorderColor)}" width="32" height="32" style="display: block; margin: 0 auto 16px auto;" alt="Gift" />`
                            }
                            
                            <!-- Title -->
                            <h3 style="margin: 0 0 8px 0; font-size: ${s.fontSize || '24px'}; font-weight: 900; color: ${vTextColor}; text-transform: uppercase;">
                                VOUCHER ƯU ĐÃI
                            </h3>
                            
                            <p style="margin: 0 0 20px 0; font-size: 14px; color: ${vTextColor}; opacity: 0.8;">
                                Sử dụng mã dưới đây khi thanh toán
                            </p>
                            
                            <!-- Code Box -->
                            <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin-bottom: 20px;">
                                <tr>
                                    <td style="border: 2px solid ${vBorderColor}; background-color: #ffffff; border-radius: 8px; padding: 10px 24px;">
                                        <span style="font-family: monospace; font-size: 20px; font-weight: bold; color: ${vBorderColor}; letter-spacing: 2px;">
                                            ${codePlaceholder}
                                        </span>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Save Button -->
                            <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center">
                                <tr>
                                    <td align="center" style="border-radius: 8px;" bgcolor="${btnBg}">
                                        <a href="#" target="_blank" style="font-size: 14px; font-weight: bold; font-family: ${fontFamily}; color: ${btnText}; text-decoration: none; border-radius: 8px; padding: 12px 32px; border: 1px solid ${btnBg}; display: inline-block; text-transform: uppercase;">
                                            LƯU MÃ NGAY
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            `;

            return wrapWithMargin(`
                <td align="center" style="${paddingCss} ${getBackgroundStyle(s)}">
                    ${innerHtml}
                </td>
            `);
        }

        if (b.type === 'review') {
            const starsHtml = Array(b.rating || 5).fill(0).map(() => `<div style="display: inline-block; margin: 0 2px;"><img src="${getIconUrl('Star', '#fbbf24')}" width="20" height="20" style="display: block; width: 20px; height: 20px;" /></div>`).join('');
            return wrapWithMargin(`\n                    <td align="center" class="${customClassName}" style="${hideOnDesktopCss}">\n                        <table border="0" cellpadding="0" cellspacing="0" width="${s.width || '100%'}" style="display: inline-table; max-width: 100%; border-radius: ${sanitizeRadius(s.borderRadius || '8px')}; overflow: hidden; border-collapse: separate;">
                            <tbody>
                                <tr>
                                    <td class="${customClassName}" style="background-color: ${s.backgroundColor || 'transparent'}; border-top: ${s.borderTopWidth || '1px'} ${(s.borderStyle && s.borderStyle !== 'none') ? s.borderStyle : 'solid'} ${s.borderColor || '#e2e8f0'}; border-right: ${s.borderRightWidth || s.borderTopWidth || '1px'} ${(s.borderStyle && s.borderStyle !== 'none') ? s.borderStyle : 'solid'} ${s.borderColor || '#e2e8f0'}; border-bottom: ${s.borderBottomWidth || s.borderTopWidth || '1px'} ${(s.borderStyle && s.borderStyle !== 'none') ? s.borderStyle : 'solid'} ${s.borderColor || '#e2e8f0'}; border-left: ${s.borderLeftWidth || s.borderTopWidth || '1px'} ${(s.borderStyle && s.borderStyle !== 'none') ? s.borderStyle : 'solid'} ${s.borderColor || '#e2e8f0'}; border-radius: ${sanitizeRadius(s.borderRadius || '8px')}; padding: ${s.paddingTop || '20px'} ${s.paddingRight || '20px'} ${s.paddingBottom || '20px'} ${s.paddingLeft || '20px'}; box-sizing: border-box;">
                                        <div style="margin-bottom: 15px; text-align: center; font-size: 0;">
                                            ${starsHtml}
                                        </div>
                                        <div class="${customClassName}" style="${commonStyle} font-size: ${s.fontSize || '14px'}; line-height: ${s.lineHeight || '1.5'};">${sanitizeHtmlLineHeight(b.content)}</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    \n                    </td>\n                `).trim();
        }

        if (b.type === 'otp') {
            const innerHtml = `
                <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="${align}" style="text-align: ${align};">
                    <tr>
                        <td align="center" class="${customClassName}" style="
                            background-color: ${s.backgroundColor || '#f0fdf4'};
                            border: ${s.borderTopWidth || '2px'} ${s.borderStyle || 'dashed'} ${s.borderColor || '#86efac'};
                            border-radius: ${sanitizeRadius(s.borderRadius || '12px')};
                            padding: ${s.paddingTop || '24px'} ${s.paddingRight || '24px'} ${s.paddingBottom || '24px'} ${s.paddingLeft || '24px'};
                            text-align: center;
                        ">
                            <span class="${customClassName}" style="
                                font-family: ${fontFamily};
                                font-size: ${s.fontSize || '36px'};
                                font-weight: ${s.fontWeight || 'bold'};
                                color: ${s.color || '#166534'};
                                letter-spacing: ${s.letterSpacing || '12px'};
                                word-break: break-all;
                                margin-left: ${s.letterSpacing || '12px'};
                                display: inline-block;
                            ">${b.content || '[short_code]'}</span>
                        </td>
                    </tr>
                </table>
            `;
            return wrapWithMargin(`<td align="${align}" class="${customClassName}" style="padding: 0; text-align: ${align}; ${hideOnDesktopCss}">${innerHtml}</td>`);
        }

        if (b.type === 'social') {
            const size = parseInt(s.iconSize || '32');
            const gap = parseInt(s.gap || '10') / 2;
            const icons = b.socialLinks?.map(l => {
                const mode = s.iconMode || 'color';
                let bg = l.customStyle?.backgroundColor || s.iconBackgroundColor || 'transparent';
                let fill = l.customStyle?.iconColor || s.iconColor;

                if (!fill) {
                    if (mode === 'original' || mode === 'color') {
                        const brandColors: any = { facebook: '#1877F2', twitter: '#1DA1F2', instagram: '#E4405F', linkedin: '#0A66C2', youtube: '#FF0000', zalo: '#0068FF' };
                        fill = brandColors[l.network] || '#666666';
                    } else {
                        fill = mode === 'dark' ? '#000000' : '#ffffff';
                    }
                }

                const ZALO_ICON_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Icon_of_Zalo.svg/960px-Icon_of_Zalo.svg.png';
                const iconUrl = l.network === 'zalo' ? ZALO_ICON_URL : getIconUrl(l.network, fill);
                const imgSize = l.network === 'zalo' ? size : size * 0.6;
                const rawSocialUrl = (l.url || '').trim();
                const socialHref = (!rawSocialUrl || rawSocialUrl === '#')
                    ? '#'
                    : (/^(?:https?:\/\/|mailto:|tel:|#|\/|\{\{)/i.test(rawSocialUrl) ? rawSocialUrl : (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(rawSocialUrl) ? 'https://' + rawSocialUrl : rawSocialUrl));
                return `<td style="padding: 0 ${gap}px;"><a href="${socialHref}" target="_blank" style="display: block; width: ${size}px; height: ${size}px; background-color: ${bg}; border-radius: ${sanitizeRadius(s.borderRadius || '4px')}; text-align: center; line-height: ${size}px;">
                    <img src="${iconUrl}" width="${imgSize}" height="${imgSize}" class="icon-img" style="vertical-align: middle; display: inline-block; width: ${imgSize}px !important; max-width: ${imgSize}px !important; height: ${imgSize}px; object-fit: contain;" />
                </a></td>`;
            }).join('');
            // [FIX] Add getBackgroundStyle so social block background color works in email clients, plus getBorderStyle(s)
            return wrapWithMargin(`<td align="${align}" class="social-block ${customClassName}" style="${paddingCss} ${getBackgroundStyle(s)} ${radiusStyle} ${getBorderStyle(s)} ${hideOnDesktopCss} text-align: ${align};"><table role="presentation" border="0" cellspacing="0" cellpadding="0" style="display: inline-table;"><tr>${icons}</tr></table></td>`);
        }

        // Text block: full styles including border, radius, background
        if (b.type === 'text') {
            const borderCss = getBorderStyle(s);
            const overflowCss = s.borderRadius ? 'overflow: hidden;' : '';
            // [FIX] Margin on <td> is ignored by Outlook/Gmail.
            // When margin is set, wrap in an outer table with margin for cross-client support.
            return wrapWithMargin(`<td align="${align}" class="text-block ${customClassName}" style="${paddingCss} ${commonStyle} font-size: ${s.fontSize || '14px'}; line-height: ${s.lineHeight || '1.5'}; ${getBackgroundStyle(s)} ${radiusStyle} ${borderCss} ${overflowCss} ${hideOnDesktopCss} text-align: ${align};">${sanitizeHtmlLineHeight(b.content)}</td>`);
        }
        if (b.type === 'image') {
            const imgWidth = s.width || '100%';
            const isPercent = imgWidth.includes('%');
            const borderCss = getBorderStyle(s);

            const imgHeight = s.height && s.height !== 'auto' ? s.height : 'auto';
            const objectFit = s.objectFit || 'cover';
            const aspectRatio = (s as any).aspectRatio;
            const ratioCss = aspectRatio && aspectRatio !== 'auto' ? `aspect-ratio: ${aspectRatio};` : '';
            
            const imgAlign = s.textAlign || align || 'center';
            const marginCss = imgAlign === 'center' ? 'margin: 0 auto;' : (imgAlign === 'right' ? 'margin-left: auto; margin-right: 0;' : 'margin-right: auto; margin-left: 0;');
            const imgClass = (isPercent || imgWidth === '100%') ? 'full-width' : '';

            // Handle aspect ratio proxy for email client compatibility (Gmail, Outlook, Yahoo strip aspect-ratio & object-fit)
            let finalSrc = b.content || '';
            const isDynamicTag = /(?:{{\s*([^{}%]+?)\s*}}|%7B%7B\s*([^{}%]+?)\s*%7D%7D)/i.test(finalSrc);
            if (aspectRatio && aspectRatio !== 'auto' && !isDynamicTag && finalSrc) {
                let cleanSrc = finalSrc;
                if (cleanSrc.includes('/img_ratio.php?') && cleanSrc.includes('url=')) {
                    try {
                        const parsed = new URL(cleanSrc, EXTERNAL_API_BASE);
                        cleanSrc = parsed.searchParams.get('url') || cleanSrc;
                    } catch (_) {}
                }
                finalSrc = `${EXTERNAL_API_BASE}/img_ratio.php?url=${encodeURIComponent(cleanSrc)}&ratio=${encodeURIComponent(aspectRatio)}&fit=${encodeURIComponent(objectFit)}`;
            }

            let fallbackSrc = b.fallbackContent || '';
            if (aspectRatio && aspectRatio !== 'auto' && fallbackSrc && !fallbackSrc.includes('{{')) {
                let cleanFallback = fallbackSrc;
                if (cleanFallback.includes('/img_ratio.php?') && cleanFallback.includes('url=')) {
                    try {
                        const parsed = new URL(cleanFallback, EXTERNAL_API_BASE);
                        cleanFallback = parsed.searchParams.get('url') || cleanFallback;
                    } catch (_) {}
                }
                fallbackSrc = `${EXTERNAL_API_BASE}/img_ratio.php?url=${encodeURIComponent(cleanFallback)}&ratio=${encodeURIComponent(aspectRatio)}&fit=${encodeURIComponent(objectFit)}`;
            }

            const rawImgLink = (b.url || '').trim();
            const cleanImgLink = (!rawImgLink || rawImgLink === '#')
                ? ''
                : (/^(?:https?:\/\/|mailto:|tel:|#|\/|\{\{)/i.test(rawImgLink) ? rawImgLink : (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(rawImgLink) ? 'https://' + rawImgLink : rawImgLink));
            const rawFallbackLink = (b.fallbackUrl || '').trim();
            const cleanFallbackLink = (!rawFallbackLink || rawFallbackLink === '#')
                ? ''
                : (/^(?:https?:\/\/|mailto:|tel:|#|\/|\{\{)/i.test(rawFallbackLink) ? rawFallbackLink : (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(rawFallbackLink) ? 'https://' + rawFallbackLink : rawFallbackLink));

            const dataFallbackSrcAttr = fallbackSrc ? ` data-fallback-src="${fallbackSrc}"` : '';
            const dataFallbackLinkAttr = cleanFallbackLink ? ` data-fallback-url="${cleanFallbackLink}"` : '';

            let imgHtml: string;
            if (isPercent) {
                imgHtml = `<img src="${finalSrc}"${dataFallbackSrcAttr} class="${imgClass} ${customClassName}" style="display: block; width: 100%; max-width: 100%; height: ${imgHeight}; object-fit: ${objectFit}; ${ratioCss} ${marginCss} border-radius: ${sanitizeRadius(s.borderRadius || '0')};" alt="${b.altText || ''}" />`;
            } else {
                const pxVal = imgWidth.replace('px', '') || '600';
                const pxHeight = imgHeight !== 'auto' ? imgHeight.replace('px', '') : '';
                imgHtml = `<img src="${finalSrc}"${dataFallbackSrcAttr} width="${pxVal}" ${pxHeight ? `height="${pxHeight}"` : ''} class="${imgClass} ${customClassName}" style="display: block; width: ${imgWidth}; max-width: 100%; height: ${imgHeight}; object-fit: ${objectFit}; ${ratioCss} ${marginCss} border-radius: ${sanitizeRadius(s.borderRadius || '0')};" alt="${b.altText || ''}" />`;
            }

            if (cleanImgLink) {
                return wrapWithMargin(`<td align="${imgAlign}" class="image-block ${customClassName}" width="100%" style="width: 100%; ${paddingCss} ${getBackgroundStyle(s)} ${radiusStyle} ${borderCss} ${hideOnDesktopCss} text-align: ${imgAlign};"><a href="${cleanImgLink}"${dataFallbackLinkAttr} target="_blank" style="display: block; text-decoration: none; width: 100%;">${imgHtml}</a></td>`);
            }
            return wrapWithMargin(`<td align="${imgAlign}" class="image-block ${customClassName}" width="100%" style="width: 100%; ${paddingCss} ${getBackgroundStyle(s)} ${radiusStyle} ${borderCss} ${hideOnDesktopCss} text-align: ${imgAlign};">${imgHtml}</td>`);
        }


        // [FIX] Divider: use hr-mimicking table cell (div is unreliable in Outlook)
        if (b.type === 'divider') return wrapWithMargin(`<td class="${customClassName}" style="${paddingCss} ${getBackgroundStyle(s)} ${radiusStyle} ${hideOnDesktopCss}"><table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%"><tr><td height="1" style="font-size: 1px; line-height: 1px; border-top: ${s.borderTopWidth || '1px'} ${s.borderStyle || 'solid'} ${s.borderColor || '#eeeeee'}; mso-line-height-rule: exactly;">&nbsp;</td></tr></table></td>`);
        // [FIX] Spacer: mso-line-height-rule: exactly for Outlook
        if (b.type === 'spacer') { const h = parseInt(s.height?.replace('px', '') || '20'); return wrapWithMargin(`<td class="${customClassName}" height="${h}" style="font-size: ${h}px; line-height: ${h}px; mso-line-height-rule: exactly; ${getBackgroundStyle(s)} ${paddingCss} ${radiusStyle} ${getBorderStyle(s)} ${hideOnDesktopCss}">&nbsp;</td>`); }

        // Fallback for unknown types
        const borderCss = getBorderStyle(s);
        return wrapWithMargin(`<td align="${align}" class="${customClassName}" style="${paddingCss} ${commonStyle} ${getBackgroundStyle(s)} ${radiusStyle} ${borderCss} ${hideOnDesktopCss} text-align: ${align};">${b.content}</td>`);
    };

    const PREVIEW_SCRIPT = `
    <script>
        (function() {
            function updateTimers() {
                var timers = document.querySelectorAll('[data-target]');
                timers.forEach(function(timer) {
                    var targetStr = timer.getAttribute('data-target');
                    if (!targetStr) return;
                    var target = new Date(targetStr).getTime();
                    var now = new Date().getTime();
                    var d = target - now;
                    if (d < 0) { d = 0; }
                    var days = Math.floor(d / (1000 * 60 * 60 * 24));
                    var hours = Math.floor((d % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    var minutes = Math.floor((d % (1000 * 60 * 60)) / (1000 * 60));
                    var seconds = Math.floor((d % (1000 * 60)) / 1000);
                    var pad = function(n) { return n < 10 ? '0' + n : n; };
                    var elDays = timer.querySelector('.days');
                    var elHours = timer.querySelector('.hours');
                    var elMins = timer.querySelector('.minutes');
                    var elSecs = timer.querySelector('.seconds');
                    if (elDays) elDays.innerText = pad(days);
                    if (elHours) elHours.innerText = pad(hours);
                    if (elMins) elMins.innerText = pad(minutes);
                    if (elSecs) elSecs.innerText = pad(seconds);
                });
            }
            setInterval(updateTimers, 1000);
            updateTimers();
        })();
            // Fixed DOMATION branding badge - bottom right
            var badge = document.createElement('div');
            badge.style.cssText = 'position:fixed;bottom:20px;right:20px;display:flex;align-items:center;gap:12px;background:rgba(255,255,255,0.97);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(0,0,0,0.07);border-radius:16px;padding:9px 18px 9px 9px;box-shadow:0 8px 32px rgba(0,0,0,0.13);z-index:99999;';
            badge.innerHTML = '<div style="position:relative;width:44px;height:44px;flex-shrink:0;"><div style="position:absolute;inset:0;background:#fbbf24;filter:blur(12px);opacity:0.35;border-radius:50%;"></div><div style="position:relative;width:44px;height:44px;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 12px rgba(245,158,11,0.25);"><img src="/imgs/ICON.png" style="width:100%;height:100%;object-fit:contain;" /></div></div><div style="display:flex;flex-direction:column;"><span style="font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:19px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;line-height:1;">DOMATION</span><div style="display:flex;align-items:center;gap:5px;margin-top:3px;opacity:0.65;"><span style="display:inline-block;width:2px;height:10px;background:#fbbf24;transform:rotate(12deg);border-radius:1px;"></span><span style="font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:8.5px;font-weight:800;color:#64748b;letter-spacing:0.18em;text-transform:uppercase;">Digital AI Vision</span></div></div>';
            document.body.appendChild(badge);
    </script>
    `;

    // ── [NEW] Auto-inject unsubscribe safety net ─────────────────────────────
    // If no block in the layout contains {{unsubscribe_url}}, append a
    // minimal legal-compliance footer row to prevent accidental spam flagging.
    const allBlocksHtml = blocks.map(b => renderBlock(b).trim()).join('');
    const hasUnsubTag = /\{\{\s*unsubscribe_url\s*\}\}/i.test(
        blocks.map(b => JSON.stringify(b)).join('')
    );
    const unsubFallbackRow = !hasUnsubTag
        ? `<tr><td align="center" style="padding: 24px 20px 16px; font-family: ${bodyStyle.fontFamily || "'Roboto', Arial, sans-serif"}; font-size: 12px; color: #94a3b8; text-align: center;">` +
          `<a href="{{unsubscribe_url}}" style="color: #94a3b8; text-decoration: underline;">Hủy đăng ký nhận email này</a>` +
          `</td></tr>`
        : '';

    return `<!DOCTYPE html>
<html lang="vi" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
<meta name="x-apple-disable-message-reformatting">
<title>${title || 'Email'}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
${getHeadCss(responsiveRules)}
</head>
<body ${getBgColorHtmlAttr(bodyStyle)} style="margin: 0; padding: 0; word-spacing: normal; ${getBackgroundStyle(bodyStyle)};">
<div role="article" aria-roledescription="email" lang="vi" style="text-size-adjust: 100%; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
<center>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 auto;">
<tbody>
<tr>
<td align="center">
  <!--[if mso]>
  <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="${parseInt(bodyStyle.contentWidth || '600')}">
  <tr>
  <td align="center" valign="top" width="${parseInt(bodyStyle.contentWidth || '600')}">
  <![endif]-->
  <!-- [FIX BUG-COMPILER-2] Use bodyStyle.contentWidth instead of hardcoded 600px so custom-width templates render correctly in all clients including old Outlook -->
  <table role="presentation" class="email-container" border="0" cellpadding="0" cellspacing="0" width="100%" ${bodyStyle.contentBackgroundColor ? `bgcolor="${bodyStyle.contentBackgroundColor}"` : ''} style="margin: 0 auto; width: 100%; max-width: ${bodyStyle.contentWidth || '600px'}; ${bodyStyle.contentBackgroundColor ? `background-color: ${bodyStyle.contentBackgroundColor};` : ''}">
  <tbody>
  ${isPreview ? '<tr><td height="40" style="font-size: 40px; line-height: 40px; mso-line-height-rule: exactly;">&nbsp;</td></tr>' : ''}
  ${allBlocksHtml}
  ${unsubFallbackRow}
  </tbody>
  </table>
  <!--[if mso]>
  </td>
  </tr>
  </table>
  <![endif]-->
</td>
</tr>
</tbody>
</table>
</center>
</div>
${isPreview ? PREVIEW_SCRIPT : '<!-- email client: no scripts -->'}
</body>
</html>`.trim();
};


