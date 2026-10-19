// components/templates/EmailEditor/components/CanvasBlock.tsx
import React from 'react';
import * as LucideIcons from 'lucide-react';
import { EmailBlock, EmailBlockType, EmailBodyStyle } from '../../../../types';
import { buildCss } from '../utils/canvasUtils';
import { sanitizeRadius, toPx } from '../utils/styleUtils';
import { CanvasDropIndicator, CanvasHandleOverlay } from './CanvasUI';
import RichText from '../RichText';
import CountdownTimer from './CountdownTimer';
import { getIconUrl } from '../utils/htmlCompiler';
import { useEditorContext } from '../contexts/EditorContext';
import TableBlockCanvas from './TableBlockCanvas';

interface CanvasBlockProps {
    block: EmailBlock;
    bodyStyle: EmailBodyStyle;
    viewMode: 'desktop' | 'mobile';
    selectedBlockId: string | null;
    dragOverId: string | null;
    dropPosition: 'top' | 'bottom' | 'inside' | 'left' | 'right' | null;
    draggingBlockId: string | null;
    onSelectBlock: (id: string | null) => void;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onDragOver: (e: React.DragEvent, id: string, type: EmailBlockType, forcedPos?: 'top' | 'bottom' | 'inside' | 'left' | 'right') => void;
    onDrop: (e: React.DragEvent, targetId: string) => void;
    onMoveOrder: (id: string, direction: 'up' | 'down') => void;
    onSwapColumns: (colId: string) => void;
    onDuplicateBlock: (block: EmailBlock) => void;
    onDeleteBlock: (id: string) => void;
    onUpdateBlockContent?: (id: string, content: string) => void;
    onUpdateBlockStyle?: (id: string, style: Partial<EmailBlock['style']>) => void;
    onUpdateBlock?: (id: string, data: Partial<EmailBlock>) => void;
    onSaveSection?: (block: EmailBlock) => void;
    onSelectParent?: () => void;
    isNoStack?: boolean;
    customMergeTags?: { label: string; key: string }[];
}

const CanvasBlock: React.FC<CanvasBlockProps> = (props) => {
    const {
        block, bodyStyle, viewMode, selectedBlockId, dragOverId, dropPosition, draggingBlockId,
        onSelectBlock, onDragStart, onDragOver, onDrop, onMoveOrder, onSwapColumns,
        onDuplicateBlock, onDeleteBlock, onUpdateBlockContent, onUpdateBlockStyle, onUpdateBlock, onSaveSection, onSelectParent,
        customMergeTags = [],
    } = props;
    const { usedColors } = useEditorContext();
    const isSelected = selectedBlockId === block.id;
    const css = buildCss(block.style, viewMode, bodyStyle.fontFamily, block.type);
    // cssAny: typed escape hatch for custom canvas properties not in CSSProperties
    const cssAny = css as any;

    const {
        marginTop, marginRight, marginBottom, marginLeft,
        paddingTop, paddingRight, paddingBottom, paddingLeft,
    } = css;

    // Decorative props go to inner content for specific blocks to prevent double background/layout breakage
    const decorativeProps = [
        'background', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat',
        'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
        'border', 'borderWidth', 'borderStyle', 'borderColor',
        'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
        'borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth',
        'boxShadow'
    ];

    const wrapperTdStyles: React.CSSProperties = {
        position: 'relative',
        width: '100%',
        verticalAlign: 'top',
        zIndex: isSelected ? 1000 : 'auto',
        padding: 0,
        border: 'none',
        borderBottom: 'none'
    };

    const decorativeStyles: React.CSSProperties = {};
    const innerPadding: React.CSSProperties = {
        paddingTop: paddingTop ?? '0px',
        paddingRight: paddingRight ?? '0px',
        paddingBottom: paddingBottom ?? '0px',
        paddingLeft: paddingLeft ?? '0px',
    };

    const isFilteredType = ['button', 'quote', 'review', 'order_list', 'header', 'otp'].includes(block.type);

    if (!isFilteredType) {
        decorativeProps.forEach(prop => {
            // @ts-ignore
            if (css[prop] !== undefined) {
                // Divider line border should be rendered on the inner element, not the outer wrapper
                if (block.type === 'divider' && prop.startsWith('border') && prop !== 'borderRadius') return;
                // Voucher and survey_card apply borderRadius and border to their inner card element
                if ((block.type === 'voucher' || block.type === 'survey_card') && prop.startsWith('border')) return;
                decorativeStyles[prop] = css[prop];
            }
        });
        if (block.type !== 'voucher' && block.type !== 'survey_card') {
            decorativeStyles.overflow = (css.borderRadius && parseFloat(String(css.borderRadius)) > 0 && !isSelected) ? 'hidden' : 'visible';
            decorativeStyles.borderRadius = css.borderRadius ? sanitizeRadius(css.borderRadius) : undefined;
        }
    } else {
        innerPadding.paddingTop = '0px';
        innerPadding.paddingRight = '0px';
        innerPadding.paddingBottom = '0px';
        innerPadding.paddingLeft = '0px';
    }

    const renderInner = () => {
        switch (block.type) {
            case 'text':
                return (
                    <RichText
                        html={block.content}
                        onChange={(newHtml) => onUpdateBlockContent?.(block.id, newHtml)}
                        disabled={!isSelected}
                        className="w-full"
                        bodyLinkColor={bodyStyle.linkColor}
                        customMergeTags={customMergeTags}
                        usedColors={usedColors}
                        blockFontSize={css.fontSize}
                        blockLineHeight={css.lineHeight}
                        style={{
                            textAlign: css.textAlign as any ?? 'left',
                            fontFamily: css.fontFamily ?? bodyStyle.fontFamily,
                            color: css.color,
                            fontWeight: css.fontWeight,
                            fontStyle: css.fontStyle,
                            textDecoration: css.textDecoration,
                            textTransform: css.textTransform
                        }}
                    />
                );

            case 'button': {
                const btnBg = cssAny.contentBackgroundColor || cssAny.buttonBackgroundColor || (css.backgroundImage && css.backgroundImage !== 'none' ? css.backgroundImage : css.backgroundColor) || '#BD1D2D';
                const containerBg = 'transparent';
                const btnColor = css.color ?? '#ffffff';
                const align = css.textAlign ?? 'center';
                const btnWidth = css.width ?? 'auto';
                const btnMarginTop = '0px';
                const btnMarginBottom = '0px';
                const btnMarginLeft = '0px';
                const btnMarginRight = '0px';
                const flexJustify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
                const btnRadius = sanitizeRadius(css.borderRadius);
                return (
                    <div style={{ width: '100%', display: 'flex', justifyContent: flexJustify, background: containerBg }}>
                        <table
                            border={0} cellPadding={0} cellSpacing={0}
                            role="presentation"
                            align={align as any}
                            style={{
                                marginTop: btnMarginTop, marginBottom: btnMarginBottom,
                                marginLeft: btnMarginLeft, marginRight: btnMarginRight,
                                display: 'table',
                                width: btnWidth === 'auto' ? 'fit-content' : btnWidth,
                                maxWidth: '100%',
                                borderCollapse: 'separate'
                            }}
                        >
                            <tbody>
                                <tr>
                                    <td align="center" style={{
                                        borderTopWidth: css.borderTopWidth,
                                        borderRightWidth: css.borderRightWidth,
                                        borderBottomWidth: css.borderBottomWidth,
                                        borderLeftWidth: css.borderLeftWidth,
                                        borderStyle: css.borderStyle,
                                        borderColor: css.borderColor,
                                        borderRadius: btnRadius,
                                        padding: 0
                                    }}>
                                        <div style={{
                                            background: btnBg,
                                            borderRadius: btnRadius,
                                            overflow: 'hidden',
                                            display: 'block',
                                            boxSizing: 'border-box',
                                            height: css.height,
                                            paddingTop: paddingTop ?? '12px',
                                            paddingBottom: paddingBottom ?? '12px',
                                            paddingLeft: paddingLeft ?? '24px',
                                            paddingRight: paddingRight ?? '24px'
                                        }}>
                                            <RichText
                                                html={block.content || 'BUTTON'}
                                                onChange={(newHtml) => onUpdateBlockContent?.(block.id, newHtml)}
                                                disabled={!isSelected}
                                                bodyLinkColor={btnColor}
                                                customMergeTags={customMergeTags}
                                                usedColors={usedColors}
                                                style={{
                                                    fontFamily: css.fontFamily ?? bodyStyle.fontFamily,
                                                    fontSize: css.fontSize ?? '16px',
                                                    fontWeight: css.fontWeight ?? 'bold',
                                                    color: btnColor,
                                                    textAlign: 'center',
                                                    letterSpacing: css.letterSpacing,
                                                    textTransform: css.textTransform as any,
                                                    fontStyle: css.fontStyle as any,
                                                    lineHeight: css.lineHeight ?? 'normal'
                                                }}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                );
            }

            case 'otp': {
                return (
                    <div style={{
                        backgroundColor: css.backgroundColor ?? '#f0fdf4',
                        color: css.color ?? '#166534',
                        fontSize: css.fontSize ?? '36px',
                        fontWeight: css.fontWeight ?? 'bold',
                        textAlign: css.textAlign as any ?? 'center',
                        letterSpacing: css.letterSpacing ?? '12px',
                        paddingTop: css.paddingTop ?? '24px',
                        paddingBottom: css.paddingBottom ?? '24px',
                        paddingLeft: css.paddingLeft ?? '24px',
                        paddingRight: css.paddingRight ?? '24px',
                        borderRadius: sanitizeRadius(css.borderRadius ?? '12px'),
                        borderColor: css.borderColor ?? '#86efac',
                        borderWidth: css.borderTopWidth ?? '2px',
                        borderStyle: css.borderStyle ?? 'dashed',
                        fontFamily: css.fontFamily ?? bodyStyle.fontFamily,
                        display: 'block',
                        wordBreak: 'break-all'
                    }}>
                        <RichText
                            html={block.content || '[short_code]'}
                            onChange={(newHtml) => onUpdateBlockContent?.(block.id, newHtml)}
                            disabled={!isSelected}
                            bodyLinkColor={css.color ?? '#166534'}
                            customMergeTags={customMergeTags}
                            usedColors={usedColors}
                            style={{
                                color: css.color ?? '#166534',
                                fontSize: css.fontSize ?? '36px',
                                fontWeight: css.fontWeight ?? 'bold',
                                textAlign: 'center',
                                letterSpacing: css.letterSpacing ?? '12px',
                                fontFamily: css.fontFamily ?? bodyStyle.fontFamily
                            }}
                        />
                    </div>
                );
            }

            case 'quote': {
                const quoteBorderLeft = `${css.borderLeftWidth ?? '4px'} ${css.borderStyle ?? 'solid'} ${css.borderColor ?? '#BD1D2D'}`;
                const quoteHasOtherBorders = css.borderTopWidth || css.borderRightWidth || css.borderBottomWidth;
                return (
                    <div style={{
                        borderLeft: quoteBorderLeft,
                        borderTop: quoteHasOtherBorders ? `${css.borderTopWidth ?? '0'} ${css.borderStyle ?? 'solid'} ${css.borderColor ?? '#BD1D2D'}` : undefined,
                        borderRight: quoteHasOtherBorders ? `${css.borderRightWidth ?? '0'} ${css.borderStyle ?? 'solid'} ${css.borderColor ?? '#BD1D2D'}` : undefined,
                        borderBottom: quoteHasOtherBorders ? `${css.borderBottomWidth ?? '0'} ${css.borderStyle ?? 'solid'} ${css.borderColor ?? '#BD1D2D'}` : undefined,
                        backgroundColor: css.backgroundColor ?? 'transparent',
                        padding: `${css.paddingTop ?? '15px'} ${css.paddingRight ?? '25px'} ${css.paddingBottom ?? '15px'} ${css.paddingLeft ?? '25px'}`,
                        color: css.color ?? '#334155',
                        fontStyle: css.fontStyle ?? 'italic',
                        fontFamily: css.fontFamily,
                        lineHeight: css.lineHeight ?? '1.6',
                        borderRadius: sanitizeRadius(css.borderRadius ?? '0'),
                        overflow: css.borderRadius ? 'hidden' : 'visible',
                        textAlign: css.textAlign as any ?? 'left'
                    }}>
                        <RichText
                            html={block.content}
                            onChange={(newHtml) => onUpdateBlockContent?.(block.id, newHtml)}
                            disabled={!isSelected}
                            bodyLinkColor={bodyStyle.linkColor}
                            customMergeTags={customMergeTags}
                            usedColors={usedColors}
                            blockFontSize={css.fontSize}
                            blockLineHeight={css.lineHeight}
                            style={{
                                color: css.color, textAlign: css.textAlign as any ?? 'left',
                                fontWeight: css.fontWeight, fontStyle: css.fontStyle,
                                textDecoration: css.textDecoration, textTransform: css.textTransform
                            }}
                        />
                    </div>
                );
            }

            case 'countdown': {
                const boxStyle: React.CSSProperties = {
                    backgroundColor: 'transparent', color: css.color ?? '#fff', textAlign: 'center',
                    fontWeight: '900', fontSize: css.fontSize ?? '48px', fontFamily: css.fontFamily,
                    lineHeight: '1', letterSpacing: '-0.02em'
                };
                const labelStyle: React.CSSProperties = {
                    fontSize: '11px', color: cssAny.labelColor ?? '#004a7c', textTransform: 'uppercase',
                    marginTop: '8px', fontWeight: '800', letterSpacing: '0.1em',
                    fontFamily: css.fontFamily
                };
                return <CountdownTimer block={block} boxStyle={boxStyle} labelStyle={labelStyle} />;
            }

            case 'timeline': {
                const dotColor = cssAny.timelineDotColor || '#BD1D2D';
                const lineColor = cssAny.timelineLineColor || '#e2e8f0';
                const timelineFontFamily = css.fontFamily;
                const titleClr = css.color || '#1e293b';
                const descClr = cssAny.timelineDescColor || '#64748b';
                return (
                    <div style={{ position: 'relative', paddingLeft: '0px' }}>
                        {block.items?.map((item, i) => {
                            const isLast = i === (block.items?.length || 0) - 1;
                            const hasDate = Boolean((item.date && item.date.trim() !== '') || isSelected);
                            const dateWidth = hasDate ? (viewMode === 'mobile' ? '60px' : '80px') : '0px';
                            const datePadding = hasDate ? '15px' : '0px';

                            return (
                                <div key={item.id || i} style={{ position: 'relative', paddingBottom: isLast ? '0' : '30px', display: 'flex' }}>
                                    <div style={{ width: dateWidth, flexShrink: 0, paddingRight: datePadding, textAlign: 'right', paddingTop: '4px', overflow: 'hidden' }}>
                                        <RichText
                                            html={item.date || ''}
                                            onChange={(newHtml) => {
                                                const nextItems = [...(block.items || [])];
                                                nextItems[i] = { ...nextItems[i], date: newHtml };
                                                onUpdateBlock?.(block.id, { items: nextItems });
                                            }}
                                            disabled={!isSelected}
                                            bodyLinkColor={bodyStyle.linkColor}
                                            customMergeTags={customMergeTags}
                                            usedColors={usedColors}
                                            style={{
                                                color: titleClr,
                                                fontSize: css.fontSize || '12px',
                                                fontFamily: timelineFontFamily,
                                                fontWeight: 'bold',
                                                textAlign: 'right'
                                            }}
                                        />
                                    </div>
                                    <div style={{ width: '24px', flexShrink: 0, position: 'relative' }}>
                                        {!isLast && (
                                            <div style={{
                                                position: 'absolute', top: '16px', left: '50%', marginLeft: '-1px',
                                                width: '0px', height: 'calc(100% + 14px)',
                                                borderLeft: `2px ${cssAny.timelineLineStyle || 'solid'} ${lineColor}`
                                            }}></div>
                                        )}
                                        <div style={{
                                            width: '12px', height: '12px', borderRadius: cssAny.timelineDotShape === 'square' ? '3px' : '50%',
                                            backgroundColor: dotColor, border: '2px solid white',
                                            boxShadow: '0 0 0 1px ' + (lineColor || '#e2e8f0'),
                                            margin: '6px auto 0', position: 'relative', zIndex: 1
                                        }}></div>
                                    </div>
                                    <div style={{ flex: 1, paddingLeft: '20px', paddingBottom: '10px' }}>
                                        <RichText
                                            html={item.title || ''}
                                            onChange={(newHtml) => {
                                                const nextItems = [...(block.items || [])];
                                                nextItems[i] = { ...nextItems[i], title: newHtml };
                                                onUpdateBlock?.(block.id, { items: nextItems });
                                            }}
                                            disabled={!isSelected}
                                            bodyLinkColor={bodyStyle.linkColor}
                                            customMergeTags={customMergeTags}
                                            usedColors={usedColors}
                                            style={{
                                                margin: '0 0 4px',
                                                fontSize: css.fontSize || '16px',
                                                color: titleClr,
                                                fontWeight: 'bold',
                                                textAlign: 'left',
                                                fontFamily: timelineFontFamily
                                            }}
                                        />
                                        <RichText
                                            html={item.description || ''}
                                            onChange={(newHtml) => {
                                                const nextItems = [...(block.items || [])];
                                                nextItems[i] = { ...nextItems[i], description: newHtml };
                                                onUpdateBlock?.(block.id, { items: nextItems });
                                            }}
                                            disabled={!isSelected}
                                            bodyLinkColor={bodyStyle.linkColor}
                                            customMergeTags={customMergeTags}
                                            usedColors={usedColors}
                                            blockLineHeight={css.lineHeight || '1.5'}
                                            style={{
                                                margin: 0,
                                                fontSize: '14px',
                                                color: descClr,
                                                textAlign: 'left',
                                                lineHeight: css.lineHeight || '1.5',
                                                fontFamily: timelineFontFamily
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            }

            case 'check_list': {
                const checkColor = cssAny.checkIconColor ?? '#BD1D2D';
                const checkSize = parseInt(cssAny.checkIconSize ?? '20');
                const showTitle = cssAny.showCheckListTitle !== false;
                const checklistIcon = cssAny.checkIcon || block.style.checkIcon || 'CheckCircle';
                // Support custom image mode
                const iconMode = cssAny.checkIconMode || 'icon';
                const customIconUrl = cssAny.checkCustomIconUrl;
                const iconUrlCheck = (iconMode === 'image' && customIconUrl) ? customIconUrl : getIconUrl(checklistIcon, checkColor);
                // Typography & color controls
                const titleFont = cssAny.checkTitleFont || css.fontFamily;
                const titleSize = cssAny.checkTitleSize ? (typeof cssAny.checkTitleSize === 'string' ? cssAny.checkTitleSize : cssAny.checkTitleSize + 'px') : '18px';
                const itemSize = cssAny.checkItemSize ? (typeof cssAny.checkItemSize === 'string' ? cssAny.checkItemSize : cssAny.checkItemSize + 'px') : '14px';
                const descSize = cssAny.checkItemSize ? `${Math.max(10, parseInt(String(cssAny.checkItemSize)) - 1)}px` : '13px';
                const titleColor = cssAny.checkTitleColor || css.color || '#1e293b';
                const itemColor = cssAny.checkItemColor || css.color || '#334155';
                const descColor = cssAny.checkDescColor || '#64748b';
                const itemFontFamily = css.fontFamily;
                return (
                    <div style={{
                        textAlign: css.textAlign as any ?? 'left',
                        width: '100%',
                        maxWidth: css.maxWidth || '100%',
                        margin: css.maxWidth ? '0 auto' : undefined
                    }}>
                        {showTitle && (
                            <div style={{ marginBottom: '15px' }}>
                                <RichText
                                    html={block.checkListTitle || 'Checklist'}
                                    onChange={(newHtml) => onUpdateBlock?.(block.id, { checkListTitle: newHtml })}
                                    disabled={!isSelected}
                                    bodyLinkColor={bodyStyle.linkColor}
                                    customMergeTags={customMergeTags}
                                    usedColors={usedColors}
                                    style={{
                                        fontSize: titleSize,
                                        fontWeight: 'bold',
                                        color: titleColor,
                                        textAlign: css.textAlign as any ?? 'left',
                                        fontFamily: titleFont
                                    }}
                                />
                            </div>
                        )}
                        <table width="100%" border={0} cellPadding={0} cellSpacing={0} role="presentation" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                            <tbody>
                                {block.items?.map((item, i) => {
                                    const showItemTitle = cssAny.showItemTitle !== false;
                                    const showItemDesc = cssAny.showItemDescription !== false;
                                    const isSingleLine = !showItemTitle || !showItemDesc;
                                    const iconPaddingTop = isSingleLine ? '5px' : '6px';
                                    const textPaddingTop = isSingleLine ? '5px' : '2px';
                                    const vAlign = cssAny.checkIconVerticalAlign || 'middle';
                                    const finalIconPaddingTop = vAlign === 'top' ? iconPaddingTop : '0px';
                                    // Icon customizations
                                    const iconRadius = sanitizeRadius(cssAny.checkIconRadius || '0');
                                    const iconBg = cssAny.checkIconBackgroundColor || 'transparent';
                                    const iconBorder = (parseInt(cssAny.checkIconBorderWidth || '0') > 0) 
                                        ? `${parseInt(String(cssAny.checkIconBorderWidth || 0))}px solid ${cssAny.checkIconBorderColor || '#e2e8f0'}` 
                                        : 'none';
                                    const iconPadding = sanitizeRadius(cssAny.checkIconPadding || '0');

                                    return (
                                        <tr key={item.id || i}>
                                            <td width={checkSize + 10} valign={vAlign} style={{ width: `${checkSize + 10}px`, padding: `${finalIconPaddingTop} 0 12px 0` }}>
                                                <div style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center', 
                                                    width: `${checkSize}px`, 
                                                    height: `${checkSize}px`,
                                                    backgroundColor: iconBg,
                                                    borderRadius: iconRadius,
                                                    border: iconBorder,
                                                    padding: iconPadding,
                                                    boxSizing: 'content-box',
                                                    overflow: 'hidden'
                                                }}>
                                                    <img 
                                                        src={(cssAny.checkIndividualIcons && iconMode === 'image' && item.customIconUrl) ? item.customIconUrl : iconUrlCheck} 
                                                        width={checkSize} 
                                                        height={checkSize} 
                                                        style={{ display: 'block', width: `${checkSize}px`, height: `${checkSize}px`, objectFit: iconMode === 'image' ? 'cover' : 'contain' }} 
                                                        alt="check" 
                                                    />
                                                </div>
                                            </td>
                                            <td valign={vAlign} style={{ padding: `${textPaddingTop} 0 12px 10px`, fontFamily: itemFontFamily, textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                                {showItemTitle && (
                                                    <RichText
                                                        html={item.title || ''}
                                                        onChange={(newHtml) => {
                                                            const nextItems = [...(block.items || [])];
                                                            nextItems[i] = { ...nextItems[i], title: newHtml };
                                                            onUpdateBlock?.(block.id, { items: nextItems });
                                                        }}
                                                        disabled={!isSelected}
                                                        bodyLinkColor={bodyStyle.linkColor}
                                                        customMergeTags={customMergeTags}
                                                        usedColors={usedColors}
                                                        style={{
                                                            fontSize: itemSize,
                                                            fontWeight: 'bold',
                                                            color: itemColor,
                                                            marginBottom: showItemDesc ? '2px' : '0',
                                                            textAlign: 'left',
                                                            whiteSpace: 'normal',
                                                            wordBreak: 'break-word',
                                                            overflowWrap: 'break-word'
                                                        }}
                                                    />
                                                )}
                                                {showItemDesc && (
                                                    <RichText
                                                        html={item.description || ''}
                                                        onChange={(newHtml) => {
                                                            const nextItems = [...(block.items || [])];
                                                            nextItems[i] = { ...nextItems[i], description: newHtml };
                                                            onUpdateBlock?.(block.id, { items: nextItems });
                                                        }}
                                                        disabled={!isSelected}
                                                        bodyLinkColor={bodyStyle.linkColor}
                                                        customMergeTags={customMergeTags}
                                                        usedColors={usedColors}
                                                        blockLineHeight="1.4"
                                                        style={{
                                                            fontSize: descSize,
                                                            color: descColor,
                                                            lineHeight: '1.4',
                                                            textAlign: 'left',
                                                            whiteSpace: 'normal',
                                                            wordBreak: 'break-word',
                                                            overflowWrap: 'break-word'
                                                        }}
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                );
            }

            case 'social': {
                const alignSocial = css.textAlign as any || 'center';
                const gapSocial = parseInt(cssAny.gap || '10') / 2;
                return (
                    <div style={{ width: '100%', textAlign: alignSocial }}>
                        <table border={0} cellPadding={0} cellSpacing={0} role="presentation" style={{ display: 'inline-table' }}>
                            <tbody>
                                <tr>
                                    {block.socialLinks?.map((l) => {
                                        const mode = cssAny.iconMode || 'color';
                                        const bg = l.customStyle?.backgroundColor || cssAny.iconBackgroundColor || 'transparent';
                                        const iconSize = parseInt(cssAny.iconSize || '32');
                                        let fill = l.customStyle?.iconColor || cssAny.iconColor;
                                        if (!fill) {
                                            if (mode === 'original' || mode === 'color') {
                                                const brandColors: any = { facebook: '#1877F2', twitter: '#1DA1F2', instagram: '#E4405F', linkedin: '#0A66C2', youtube: '#FF0000', zalo: '#0068FF' };
                                                fill = brandColors[l.network] || '#666666';
                                            } else {
                                                fill = mode === 'dark' ? '#000000' : '#ffffff';
                                            }
                                        }
                                        // Zalo dùng image URL thực, các mạng khác dùng icon service
                                        const ZALO_ICON_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Icon_of_Zalo.svg/960px-Icon_of_Zalo.svg.png';
                                        const iconSrc = l.network === 'zalo' ? ZALO_ICON_URL : getIconUrl(l.network, fill);
                                        return (
                                            <td key={l.id} style={{ padding: `0 ${gapSocial}px` }}>
                                                <div style={{ width: `${iconSize}px`, height: `${iconSize}px`, backgroundColor: bg, borderRadius: sanitizeRadius(css.borderRadius || '4px'), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                    <img src={iconSrc} width={l.network === 'zalo' ? iconSize : iconSize * 0.6} height={l.network === 'zalo' ? iconSize : iconSize * 0.6} style={{ display: 'block', width: l.network === 'zalo' ? `${iconSize}px` : `${iconSize * 0.6}px`, height: l.network === 'zalo' ? `${iconSize}px` : `${iconSize * 0.6}px`, objectFit: 'contain' }} alt={l.network} />
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                );
            }

            case 'image': {
                const imgWidth = css.width ?? '100%';
                const imgHeight = css.height && css.height !== 'auto' ? css.height : 'auto';
                const objectFit = block.style.objectFit || 'cover';
                const aspectRatio = (block.style as any).aspectRatio;
                const borderRadius = sanitizeRadius(css.borderRadius);
                const isVariableSrc = /(?:{{\s*([^{}%]+?)\s*}}|%7B%7B\s*([^{}%]+?)\s*%7D%7D)/i.test(block.content || '');

                return (
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: css.textAlign === 'left' ? 'flex-start' : css.textAlign === 'right' ? 'flex-end' : 'center', 
                        width: '100%' 
                    }}>
                        {block.content ? (
                            isVariableSrc ? (
                                block.fallbackContent ? (
                                    <div style={{
                                        width: imgWidth,
                                        height: imgHeight,
                                        aspectRatio: aspectRatio && aspectRatio !== 'auto' ? aspectRatio : undefined,
                                        borderRadius: borderRadius,
                                        overflow: 'hidden',
                                        display: 'inline-block',
                                        maxWidth: '100%',
                                        position: 'relative'
                                    }} className="group/dynimg">
                                        <img
                                            src={block.fallbackContent}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: objectFit as any,
                                                objectPosition: 'center',
                                                display: 'block',
                                                borderRadius: borderRadius
                                            }}
                                            alt={block.altText || 'Fallback preview'}
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-xs text-white font-mono text-[9px] font-bold border border-[#BD1D2D]/40 flex items-center gap-1 shadow-sm">
                                            <LucideIcons.Sparkles className="w-2.5 h-2.5 text-[#BD1D2D]" />
                                            <span>{block.content}</span>
                                            <span className="text-white/60 font-sans font-normal">(Ảnh dự phòng)</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div 
                                        style={{
                                            width: imgWidth,
                                            height: imgHeight !== 'auto' ? imgHeight : undefined,
                                            aspectRatio: aspectRatio && aspectRatio !== 'auto' ? aspectRatio : '16/9',
                                            borderRadius: borderRadius || '16px',
                                            maxWidth: '100%',
                                        }}
                                        className="w-full bg-gradient-to-br from-[#BD1D2D]/5 via-rose-50/40 to-[#BD1D2D]/10 border-2 border-dashed border-[#BD1D2D]/40 rounded-[14px] flex flex-col items-center justify-center p-6 text-center shadow-xs"
                                    >
                                        <div className="w-12 h-12 bg-[#BD1D2D]/10 border border-[#BD1D2D]/20 rounded-[14px] flex items-center justify-center mb-2 shadow-xs">
                                            <LucideIcons.Sparkles className="text-[#BD1D2D] w-6 h-6 animate-pulse" />
                                        </div>
                                        <div className="font-mono text-xs font-bold text-[#BD1D2D] bg-[#BD1D2D]/10 px-2.5 py-1 rounded-lg border border-[#BD1D2D]/30 mb-1">
                                            {block.content}
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-700 tracking-wide">ẢNH ĐỘNG CÁ NHÂN HÓA</span>
                                        <span className="text-[9px] text-slate-400 font-medium max-w-xs mt-0.5">Hệ thống sẽ tự động gán ảnh riêng cho từng người nhận khi gửi mail</span>
                                    </div>
                                )
                            ) : (
                                <div style={{
                                    width: imgWidth,
                                    height: imgHeight,
                                    aspectRatio: aspectRatio && aspectRatio !== 'auto' ? aspectRatio : undefined,
                                    borderRadius: borderRadius,
                                    overflow: 'hidden',
                                    display: 'inline-block',
                                    maxWidth: '100%',
                                }}>
                                    <img
                                        src={block.content}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: objectFit as any,
                                            objectPosition: 'center',
                                            display: 'block',
                                            borderRadius: borderRadius
                                        }}
                                        alt={block.altText}
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                </div>
                            )
                        ) : (
                            <div className="w-full aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-[14px] flex flex-col items-center justify-center group/img transition-all hover:bg-slate-100 hover:border-emerald-500/30">
                                <div className="w-16 h-16 bg-white rounded-[14px] shadow-sm flex items-center justify-center mb-3 group-hover/img:scale-110 transition-transform">
                                    <LucideIcons.Image className="text-slate-300 w-8 h-8" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400" style={{ fontFamily: bodyStyle.fontFamily }}>Kéo thả hoặc chọn ảnh</span>
                            </div>
                        )}
                    </div>
                );
            }

            case 'divider':
                return (
                    <div style={{ borderTop: `${css.borderTopWidth ?? '1px'} ${css.borderStyle ?? 'solid'} ${css.borderColor ?? '#eeeeee'}` }}></div>
                );

            case 'spacer':
                return <div style={{ height: css.height ?? '20px', backgroundColor: css.backgroundColor ?? 'transparent' }}></div>;

            case 'video': {
                const videoAlign = css.textAlign as any || 'center';
                const playBtnColor = cssAny.playButtonColor || '#BD1D2D';
                return (
                    <div style={{ textAlign: videoAlign }}>
                        {block.videoUrl ? (
                            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', borderRadius: sanitizeRadius(css.borderRadius || '12px'), overflow: 'hidden' }}>
                                {/* Thumbnail */}
                                <img
                                    src={block.thumbnailUrl || 'https://via.placeholder.com/600x340?text=Video+Thumbnail'}
                                    style={{ maxWidth: '100%', width: '100%', height: 'auto', borderRadius: sanitizeRadius(css.borderRadius || '12px'), display: 'block' }}
                                    alt="Video"
                                />
                                {/* ✅ Nút play overlay chính giữa bằng absolute */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    width: '100%', height: '100%',
                                    backgroundColor: 'rgba(0,0,0,0.3)',
                                    borderRadius: sanitizeRadius(css.borderRadius || '12px'),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    pointerEvents: 'none'
                                }}>
                                    <div style={{
                                        width: '60px', height: '60px',
                                        borderRadius: '50%',
                                        backgroundColor: playBtnColor,
                                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        pointerEvents: 'auto',
                                        cursor: 'pointer'
                                    }}>
                                        <img
                                            src="https://cdn-icons-png.flaticon.com/512/0/375.png"
                                            width={28} height={28}
                                            style={{ display: 'block', filter: 'invert(1)', marginLeft: '3px' }}
                                            alt="play"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full aspect-video bg-slate-900 rounded-[14px] flex flex-col items-center justify-center group/vid border-4 border-slate-800 shadow-inner overflow-hidden relative">
                                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(0,0,0,0.4)_0%,transparent_100%)]"></div>
                                <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center mb-4 group-hover/vid:scale-110 transition-transform border border-white/20">
                                    <LucideIcons.PlayCircle className="text-white/40 w-10 h-10" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 relative z-10" style={{ fontFamily: bodyStyle.fontFamily }}>Dán link Youtube/Vimeo</span>
                            </div>
                        )}
                    </div>
                );
            }

            case 'order_list':
                return (
                    <div style={{
                        padding: `${css.paddingTop ?? '24px'} ${css.paddingRight ?? '24px'} ${css.paddingBottom ?? '24px'} ${css.paddingLeft ?? '24px'}`,
                        backgroundColor: css.backgroundColor ?? '#ffffff',
                        borderRadius: sanitizeRadius(css.borderRadius ?? '16px'),
                        border: (css as any).border ?? '1px solid #f1f5f9',
                        boxShadow: css.boxShadow ?? '0 4px 6px -1px rgb(0 0 0 / 0.05)'
                    }}>
                        <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-500">
                                    <LucideIcons.ShoppingBag size={16} />
                                </div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700" style={{ fontFamily: bodyStyle.fontFamily }}>Giỏ hàng của bạn</span>
                            </div>
                            <span className="text-[9px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-bold uppercase tracking-tighter">Preview</span>
                        </div>
                        {[1, 2].map(i => (
                            <div key={i} className="flex gap-4 mb-4 items-center last:mb-0">
                                <div className="w-14 h-14 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center shrink-0">
                                    <LucideIcons.Package size={20} className="text-slate-300" />
                                </div>
                                <div className="flex-1">
                                    <div className="h-4 bg-slate-100 w-2/3 mb-2 rounded-full"></div>
                                    <div className="h-3 bg-slate-50 w-full rounded-full"></div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="h-4 bg-emerald-50 w-12 mb-1 rounded-full ml-auto"></div>
                                    <div className="h-3 bg-slate-50 w-8 rounded-full ml-auto"></div>
                                </div>
                            </div>
                        ))}
                        <div className="mt-6 pt-4 border-t border-slate-50 space-y-2">
                            <div className="flex justify-between items-center opacity-40">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Tạm tính</span>
                                <div className="h-3 bg-slate-200 w-12 rounded-full"></div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-700 uppercase" style={{ fontFamily: bodyStyle.fontFamily }}>Tổng cộng</span>
                                <div className="h-4 bg-emerald-500/20 w-16 rounded-full border border-emerald-500/30"></div>
                            </div>
                        </div>
                    </div>
                );

            case 'voucher': {
                const voucherStyle = cssAny.voucherStyle || 'ticket';
                const vBorderColor = cssAny.voucherBorderColor || '#BD1D2D';
                const vBorderStyle = cssAny.voucherBorderStyle || 'dashed';
                const vBg = cssAny.voucherBg || '#fffbe1';
                const vTextColor = cssAny.voucherTextColor || '#b45309';
                const btnBg = cssAny.voucherButtonBg || '#BD1D2D';
                const btnText = cssAny.voucherButtonTextColor || '#ffffff';
                const linkId = block.voucherCampaignId;
                
                let previewImgUrl = '';
                if (linkId) {
                    try {
                        const stored = JSON.parse(localStorage.getItem('mailflow_voucher_campaigns') || '[]');
                        const camp = stored.find((c: any) => c.id === linkId);
                        if (camp && camp.rewards && camp.rewards.length > 0) {
                            previewImgUrl = camp.rewards[0].imageUrl || '';
                        }
                    } catch (e) {}
                }
                
                return (
                    <div style={{
                        width: '100%'
                    }}>
                        <div style={{
                            border: `2px ${vBorderStyle} ${vBorderColor}`,
                            backgroundColor: vBg,
                            borderRadius: sanitizeRadius(css.borderRadius ?? '12px'),
                            padding: '24px',
                            textAlign: 'center',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Cutout effects for ticket style */}
                            {voucherStyle === 'ticket' && (
                                <>
                                    <div style={{ position: 'absolute', top: '50%', left: '-12px', width: '24px', height: '24px', backgroundColor: css.backgroundColor ?? '#ffffff', borderRadius: '50%', transform: 'translateY(-50%)', borderRight: `2px ${vBorderStyle} ${vBorderColor}` }}></div>
                                    <div style={{ position: 'absolute', top: '50%', right: '-12px', width: '24px', height: '24px', backgroundColor: css.backgroundColor ?? '#ffffff', borderRadius: '50%', transform: 'translateY(-50%)', borderLeft: `2px ${vBorderStyle} ${vBorderColor}` }}></div>
                                </>
                            )}
                            
                            <div style={{ marginBottom: '16px' }}>
                                {previewImgUrl ? (
                                    <img src={previewImgUrl} alt="Reward" style={{ maxHeight: '100px', objectFit: 'contain', margin: '0 auto', display: 'block', borderRadius: '8px' }} />
                                ) : (
                                    <LucideIcons.Gift size={32} color={vBorderColor} style={{ margin: '0 auto' }} />
                                )}
                            </div>
                            
                            <h3 style={{ 
                                fontFamily: bodyStyle.fontFamily, 
                                fontSize: css.fontSize ?? '24px', 
                                fontWeight: '900', 
                                color: vTextColor,
                                margin: '0 0 8px 0',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                {linkId ? 'VOUCHER ƯU ĐÃI' : 'VOUCHER ƯU ĐÃI'}
                            </h3>
                            
                            <p style={{
                                fontFamily: bodyStyle.fontFamily,
                                color: vTextColor,
                                opacity: 0.8,
                                fontSize: '14px',
                                margin: '0 0 20px 0'
                            }}>
                                {linkId ? 'Áp dụng trước khi ưu đãi kết thúc' : 'Chưa chọn chiến dịch! Vui lòng chọn ở panel bên phải.'}
                            </p>
                            
                            <div style={{
                                display: 'inline-block',
                                border: `2px solid ${vBorderColor}`,
                                backgroundColor: 'rgba(255,255,255,0.5)',
                                padding: '10px 24px',
                                borderRadius: '8px',
                                fontSize: '20px',
                                fontWeight: 'bold',
                                color: vBorderColor,
                                letterSpacing: '3px',
                                marginBottom: '20px'
                            }}>
                                {linkId ? 'SUMMER26' : 'XXXX-XXXX'}
                            </div>
                            <br/>
                            
                            <a href={block.url || '#'} onClick={(e) => e.preventDefault()} style={{
                                display: 'inline-block',
                                backgroundColor: btnBg,
                                color: btnText,
                                padding: '12px 24px',
                                borderRadius: sanitizeRadius(css.borderRadius ?? '8px'),
                                textDecoration: 'none',
                                fontWeight: 'bold',
                                fontFamily: css.fontFamily || bodyStyle.fontFamily,
                                textTransform: 'uppercase',
                                fontSize: '14px'
                            }}>
                                {cssAny.buttonText || cssAny.voucherButtonText || 'LƯU MÃ NGAY'}
                            </a>
                        </div>
                    </div>
                );
            }

            case 'review':
                return (
                    <table border={0} cellPadding={0} cellSpacing={0} role="presentation" width={css.width || '100%'} style={{ display: 'inline-table', maxWidth: '100%' }}>
                        <tbody>
                            <tr>
                                <td style={{
                                    background: (css.backgroundImage && css.backgroundImage !== 'none') ? css.backgroundImage : (css.backgroundColor ?? 'transparent'),
                                    backgroundColor: css.backgroundColor ?? 'transparent',
                                    borderRadius: sanitizeRadius(css.borderRadius ?? '8px'),
                                    borderTopWidth: css.borderTopWidth ?? '1px',
                                    borderRightWidth: css.borderRightWidth ?? css.borderTopWidth ?? '1px',
                                    borderBottomWidth: css.borderBottomWidth ?? css.borderTopWidth ?? '1px',
                                    borderLeftWidth: css.borderLeftWidth ?? css.borderTopWidth ?? '1px',
                                    borderStyle: (css.borderStyle && css.borderStyle !== 'none') ? css.borderStyle : 'solid',
                                    borderColor: css.borderColor ?? '#e2e8f0',
                                    padding: `${css.paddingTop ?? '20px'} ${css.paddingRight ?? '20px'} ${css.paddingBottom ?? '20px'} ${css.paddingLeft ?? '20px'}`,
                                    boxSizing: 'border-box',
                                    fontFamily: css.fontFamily ?? bodyStyle.fontFamily,
                                    color: css.color ?? '#333333',
                                    fontSize: css.fontSize ?? '14px',
                                    lineHeight: css.lineHeight ?? '1.5',
                                    textAlign: css.textAlign as any ?? 'center'
                                }}>
                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '15px' }}>
                                        {Array(block.rating || 5).fill(0).map((_, i) => (
                                            <div key={i} style={{ display: 'inline-block', margin: '0 2px' }}>
                                                <img src={getIconUrl('Star', '#fbbf24')} width={20} height={20} style={{ display: 'block', width: '20px', height: '20px' }} alt="star" />
                                            </div>
                                        ))}
                                    </div>
                                    <RichText
                                        html={block.content}
                                        onChange={(newHtml) => onUpdateBlockContent?.(block.id, newHtml)}
                                        disabled={!isSelected}
                                        className="w-full"
                                        bodyLinkColor={bodyStyle.linkColor}
                                        customMergeTags={customMergeTags}
                                        blockFontSize={css.fontSize}
                                        blockLineHeight={css.lineHeight}
                                        style={{
                                            color: css.color, textAlign: css.textAlign as any ?? 'center',
                                            fontWeight: css.fontWeight, fontStyle: css.fontStyle,
                                            textDecoration: css.textDecoration, textTransform: css.textTransform
                                        }}
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                );

            case 'header': {
                const globalMenuType = cssAny.headerMenuType || (block.style as any).headerMenuType || 'link';
                const menuGap = cssAny.menuGap || (block.style as any).menuGap || '20px';
                const logoWidth = cssAny.logoWidth || (block.style as any).logoWidth || '120px';
                const btnBg = cssAny.buttonBg || (block.style as any).buttonBg || '#BD1D2D';
                const btnColor = cssAny.buttonColor || (block.style as any).buttonColor || '#ffffff';
                const menuItems = block.items || [];

                const onLogoResizeMouseDown = (e: React.MouseEvent) => {
                    if (!isSelected) return;
                    e.preventDefault();
                    e.stopPropagation();

                    const startX = e.clientX;
                    const startWidth = parseInt(logoWidth);

                    const onMouseMove = (moveEvent: MouseEvent) => {
                        const delta = moveEvent.clientX - startX;
                        const newWidth = Math.max(30, Math.min(500, startWidth + delta));
                        onUpdateBlock?.(block.id, { style: { ...block.style, logoWidth: `${newWidth}px` } as any });
                    };

                    const onMouseUp = () => {
                        window.removeEventListener('mousemove', onMouseMove);
                        window.removeEventListener('mouseup', onMouseUp);
                        document.body.style.cursor = 'default';
                    };

                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                    document.body.style.cursor = 'col-resize';
                };

                return (
                    <div style={{
                        width: '100%',
                        padding: `${css.paddingTop ?? '15px'} ${css.paddingRight ?? '30px'} ${css.paddingBottom ?? '15px'} ${css.paddingLeft ?? '30px'}`,
                        background: (css.backgroundImage && css.backgroundImage !== 'none') ? css.backgroundImage : (css.backgroundColor ?? '#ffffff'),
                        backgroundColor: css.backgroundColor ?? '#ffffff',
                        borderTop: cssAny.borderTop,
                        borderRight: cssAny.borderRight,
                        borderBottom: cssAny.borderBottom,
                        borderLeft: cssAny.borderLeft,
                        borderRadius: sanitizeRadius(css.borderRadius),
                        overflow: 'visible', // Changed to visible for resize handle
                        boxSizing: 'border-box'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexDirection: viewMode === 'mobile' ? 'column' : 'row'
                        }}>
                             {/* Logo Section */}
                            <div style={{ 
                                flexShrink: 0, 
                                width: viewMode === 'mobile' ? '100%' : 'auto', 
                                textAlign: viewMode === 'mobile' ? 'center' : 'left',
                                marginBottom: viewMode === 'mobile' ? '15px' : '0px',
                                position: 'relative',
                                display: 'inline-block'
                            }}>
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <img 
                                        src={block.content || 'https://via.placeholder.com/120x40?text=Logo'} 
                                        style={{ width: logoWidth, height: 'auto', display: 'inline-block' }} 
                                        alt={block.altText || 'Logo'} 
                                    />
                                    {isSelected && viewMode !== 'mobile' && (
                                        <div 
                                            onMouseDown={onLogoResizeMouseDown}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                bottom: 0,
                                                right: -8,
                                                width: 16,
                                                cursor: 'col-resize',
                                                zIndex: 30,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            className="group/resizer"
                                        >
                                            {/* Visual Handle */}
                                            <div className="w-1.5 h-full flex flex-col items-center justify-center gap-1 group-hover/resizer:bg-[#BD1D2D]/10 rounded-full transition-all">
                                                <div className="w-1 h-12 bg-[#BD1D2D] rounded-full shadow-sm" />
                                                <div className="absolute -right-1.5 bg-[var(--color-primary)] text-white p-1 rounded-full shadow-lg opacity-0 group-hover/resizer:opacity-100 transition-opacity">
                                                    <LucideIcons.ChevronsLeftRight className="w-2.5 h-2.5" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Menu Section */}
                            <div style={{ 
                                display: 'flex', 
                                flexWrap: 'wrap',
                                justifyContent: viewMode === 'mobile' ? 'center' : 'flex-end',
                                width: viewMode === 'mobile' ? '100%' : 'auto',
                                gap: menuGap,
                                alignItems: 'center'
                            }}>
                                {menuItems.map((item) => {
                                    const itemType = item.menuType || globalMenuType;
                                    return (
                                        <div key={item.id}>
                                            {itemType === 'button' ? (
                                                <div style={{
                                                    padding: '8px 16px',
                                                    backgroundColor: btnBg,
                                                    color: btnColor,
                                                    borderRadius: '6px',
                                                    fontSize: '13px',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer'
                                                }}>
                                                    {item.title}
                                                </div>
                                            ) : (
                                                <div style={{
                                                    fontSize: '14px',
                                                    fontWeight: '600',
                                                    color: css.color || '#475569',
                                                    cursor: 'pointer',
                                                    fontFamily: css.fontFamily
                                                }}>
                                                    {item.title}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            }

            case 'table':
                return (
                    <TableBlockCanvas
                        block={block}
                        isSelected={isSelected}
                        onUpdate={(data) => {
                            // Combined atomic update — avoids two-render stale-cols bug
                            if (data.content !== undefined && data.style !== undefined) {
                                onUpdateBlock?.(block.id, { content: data.content, style: data.style as any });
                            } else {
                                if (data.content !== undefined) onUpdateBlockContent?.(block.id, data.content);
                                if (data.style !== undefined) onUpdateBlockStyle?.(block.id, data.style);
                            }
                        }}
                    />
                );

            case 'survey_card': {
                const s = cssAny;
                const rawAccent = s.surveyAccentColor || '#BD1D2D';
                // Normalize legacy default blue+baby-blue border to MYERP cohesive style if untouched
                const isLegacyDefaultBlue = rawAccent.toUpperCase() === '#2563EB' && (s.surveyBorderColor || '').toUpperCase() === '#BFDBFE';
                const accent = isLegacyDefaultBlue ? '#BD1D2D' : rawAccent;
                const cardBg = s.surveyCardBgColor || '#FFFFFF';
                const borderCol = isLegacyDefaultBlue ? '#E2E8F0' : (s.surveyBorderColor || '#E2E8F0');
                const btnBgColor = s.surveyButtonBgColor || accent;
                const btnTextColor = s.surveyButtonTextColor || '#FFFFFF';
                const badgeText = s.surveyBadgeText ?? 'KHẢO SÁT NHANH';
                const titleText = s.surveyTitle || block.content || 'Khảo sát mức độ hài lòng của bạn';
                const descText = s.surveyDescription || 'Ý kiến của bạn giúp chúng tôi nâng cao chất lượng dịch vụ mỗi ngày.';
                const btnText = s.surveyButtonText || 'Tham gia khảo sát ngay →';
                const radius = sanitizeRadius(s.borderRadius || '16px');
                const alignVal = (s.textAlign as any) || 'center';
                const cardFont = css.fontFamily || bodyStyle.fontFamily || "'Inter', 'Roboto', Arial, sans-serif";

                return (
                    <div
                        style={{
                            backgroundColor: cardBg,
                            border: `1.5px solid ${borderCol}`,
                            borderTop: `3.5px solid ${accent}`,
                            borderRadius: radius,
                            padding: '28px 24px',
                            textAlign: alignVal,
                            boxSizing: 'border-box',
                            fontFamily: cardFont,
                        }}
                    >
                        {badgeText && (
                            <div
                                contentEditable={isSelected}
                                suppressContentEditableWarning
                                onBlur={(e) => onUpdateBlockStyle?.(block.id, { surveyBadgeText: e.currentTarget.innerText })}
                                style={{
                                    display: 'inline-block',
                                    backgroundColor: `${accent}14`,
                                    border: `1px solid ${accent}2E`,
                                    color: accent,
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    fontFamily: cardFont,
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                    padding: '4px 12px',
                                    borderRadius: '999px',
                                    marginBottom: '12px',
                                    outline: 'none',
                                }}
                            >
                                {badgeText}
                            </div>
                        )}
                        <div style={{ margin: '0 0 8px 0' }}>
                            <RichText
                                html={titleText}
                                onChange={(val) => onUpdateBlockStyle?.(block.id, { surveyTitle: val })}
                                disabled={!isSelected}
                                bodyLinkColor={bodyStyle.linkColor}
                                customMergeTags={customMergeTags}
                                style={{
                                    fontSize: '19px',
                                    fontWeight: 700,
                                    color: '#0F172A',
                                    lineHeight: 1.35,
                                    textAlign: alignVal,
                                    fontFamily: cardFont,
                                }}
                            />
                        </div>
                        <div style={{ margin: '0 auto 20px auto', maxWidth: '500px' }}>
                            <RichText
                                html={descText}
                                onChange={(val) => onUpdateBlockStyle?.(block.id, { surveyDescription: val })}
                                disabled={!isSelected}
                                bodyLinkColor={bodyStyle.linkColor}
                                customMergeTags={customMergeTags}
                                style={{
                                    fontSize: '14px',
                                    color: '#475569',
                                    lineHeight: 1.6,
                                    textAlign: alignVal,
                                    fontFamily: cardFont,
                                }}
                            />
                        </div>
                        <div style={{ textAlign: alignVal }}>
                            <span
                                contentEditable={isSelected}
                                suppressContentEditableWarning
                                onBlur={(e) => onUpdateBlockStyle?.(block.id, { surveyButtonText: e.currentTarget.innerText })}
                                style={{
                                    backgroundColor: btnBgColor,
                                    color: btnTextColor,
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    fontFamily: cardFont,
                                    padding: '12px 28px',
                                    borderRadius: '10px',
                                    textDecoration: 'none',
                                    display: 'inline-block',
                                    outline: 'none',
                                    lineHeight: 1.2,
                                }}
                            >
                                {btnText}
                            </span>
                        </div>
                    </div>
                );
            }

            default:
                return (
                    <RichText
                        html={block.content}
                        onChange={(newHtml) => onUpdateBlockContent?.(block.id, newHtml)}
                        disabled={!isSelected}
                        bodyLinkColor={bodyStyle.linkColor}
                        customMergeTags={customMergeTags}
                        style={{
                            textAlign: css.textAlign as any ?? 'left',
                            fontFamily: css.fontFamily ?? bodyStyle.fontFamily,
                            color: css.color, fontWeight: css.fontWeight,
                            fontStyle: css.fontStyle, textDecoration: css.textDecoration,
                            textTransform: css.textTransform
                        }}
                    />
                );
        }
    };

    const s = block.style || {};
    const isHiddenInCurrentView = (viewMode === 'mobile' && s.hideOnMobile) || (viewMode === 'desktop' && s.hideOnDesktop);

    return (
        <tr
            key={block.id} id={`block-${block.id}`}
            draggable={!isSelected}
            onDragStart={(e) => {
                if (isSelected || document.activeElement?.closest('[contenteditable="true"], input, textarea')) {
                    e.preventDefault();
                    return;
                }
                onDragStart(e, block.id);
            }}
            onDragOver={(e) => onDragOver(e, block.id, block.type)} onDrop={(e) => onDrop(e, block.id)} onClick={(e) => { e.stopPropagation(); onSelectBlock(block.id); }}
            style={{
                position: isSelected ? 'relative' : 'static',
                zIndex: isSelected ? 1000 : 'auto'
            }}
        >
            <td 
                className={`relative transition-all w-full group/block ${
                    draggingBlockId === block.id 
                        ? 'opacity-30 border-2 border-dashed border-[#BD1D2D] bg-[#BD1D2D]/5' 
                        : ''
                } ${isHiddenInCurrentView ? 'opacity-45' : ''}`} 
                style={wrapperTdStyles}
            >
                {dragOverId === block.id && dropPosition && <CanvasDropIndicator dropPosition={dropPosition} />}
                <CanvasHandleOverlay block={block} color="ring-[#BD1D2D]" isSelected={isSelected} onDragStart={onDragStart} onMoveOrder={onMoveOrder} onSwapColumns={onSwapColumns} onDuplicateBlock={onDuplicateBlock} onDeleteBlock={onDeleteBlock} onSelectParent={onSelectParent} onSaveSection={onSaveSection} />

                {/* Hover outline strictly contained inside block bounds */}
                {!isSelected && (
                    <div className="absolute inset-0 pointer-events-none border-2 border-transparent group-hover/block:border-[#BD1D2D]/40 rounded-[inherit] z-20 transition-colors" />
                )}

                <div style={{
                    ...decorativeStyles,
                    ...(['button', 'quote', 'review', 'order_list', 'header', 'otp'].includes(block.type) ? {} : innerPadding),
                    marginTop: marginTop ?? '0',
                    marginRight: marginRight ?? '0',
                    marginBottom: marginBottom ?? '0',
                    marginLeft: marginLeft ?? '0',
                    width: (parseInt(String(s.marginLeft || marginLeft || 0)) || parseInt(String(s.marginRight || marginRight || 0))) ? 'auto' : '100%',
                    boxSizing: 'border-box'
                }}>
                    {renderInner()}
                </div>

                {!isSelected && <div className="absolute inset-0 z-10 cursor-pointer" title="Click to select" />}
            </td>
        </tr>
    );
};

export default CanvasBlock;
