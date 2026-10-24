import * as React from 'react';
import { motion } from 'framer-motion';

import {
  AvatarGroup as AvatarGroupPrimitive,
  AvatarGroupTooltip as AvatarGroupTooltipPrimitive,
  AvatarGroupTooltipArrow as AvatarGroupTooltipArrowPrimitive,
  type AvatarGroupProps as AvatarGroupPropsPrimitive,
  type AvatarGroupTooltipProps as AvatarGroupTooltipPropsPrimitive,
  type AvatarGroupTooltipArrowProps as AvatarGroupTooltipArrowPropsPrimitive,
} from '../primitives/animate/avatar-group';
import { cn } from '../lib/utils';
import { Avatar } from '../../ui/Avatar';

type AvatarGroupProps = AvatarGroupPropsPrimitive;

function AvatarGroup({
  className,
  invertOverlap = true,
  style,
  ...props
}: AvatarGroupProps) {
  return (
    <AvatarGroupPrimitive
      className={cn('animate-ui-avatar-group', className)}
      invertOverlap={invertOverlap}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        ...style,
      }}
      {...props}
    />
  );
}

type AvatarGroupTooltipProps = Omit<
  AvatarGroupTooltipPropsPrimitive,
  'asChild'
> & {
  children: React.ReactNode;
  layout?: boolean | 'position' | 'size' | 'preserve-aspect';
};

function AvatarGroupTooltip({
  className,
  children,
  layout = 'preserve-aspect',
  style,
  ...props
}: AvatarGroupTooltipProps) {
  return (
    <AvatarGroupTooltipPrimitive
      className={cn('animate-ui-avatar-group-tooltip', className)}
      style={{
        background: '#0f172a',
        color: '#ffffff',
        borderRadius: '8px',
        padding: '5px 10px',
        fontSize: '0.74rem',
        fontWeight: 700,
        lineHeight: 1.35,
        boxShadow: '0 8px 20px rgba(15, 23, 42, 0.22)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        width: 'fit-content',
        maxWidth: '240px',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...props}
    >
      <motion.div
        layout={layout}
        style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        {children}
      </motion.div>
      <AvatarGroupTooltipArrowPrimitive
        style={{ fill: '#0f172a' }}
        tipRadius={2}
      />
    </AvatarGroupTooltipPrimitive>
  );
}

const AvatarGroupTooltipArrow = AvatarGroupTooltipArrowPrimitive;
type AvatarGroupTooltipArrowProps = AvatarGroupTooltipArrowPropsPrimitive;

export interface AnimatedAvatarItem {
  id?: string | number;
  name: string;
  src?: string | null;
  subtitle?: string;
  badge?: string;
  onClick?: () => void;
}

export interface AnimatedAvatarGroupProps {
  items: AnimatedAvatarItem[];
  max?: number;
  size?: number;
  overlap?: number;
  invertOverlap?: boolean;
  translate?: string | number;
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  ringColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

function AnimatedAvatarGroup({
  items,
  max = 5,
  size = 28,
  overlap = -8,
  invertOverlap = true,
  translate = '-30%',
  side = 'top',
  sideOffset = 10,
  ringColor = '#ffffff',
  className,
  style,
}: AnimatedAvatarGroupProps) {
  const safeItems = Array.isArray(items) ? items.filter((it) => it && it.name) : [];
  if (safeItems.length === 0) return null;

  const visibleItems = max > 0 ? safeItems.slice(0, max) : safeItems;
  const overflowItems = max > 0 && safeItems.length > max ? safeItems.slice(max) : [];

  const childrenElements: React.ReactElement[] = visibleItems.map((item, idx) => (
    <div
      key={item.id ?? `${item.name}-${idx}`}
      onClick={(e) => {
        if (item.onClick) {
          e.stopPropagation();
          item.onClick();
        }
      }}
      style={{
        marginLeft: idx === 0 ? 0 : overlap,
        borderRadius: '999px',
        border: `2px solid ${ringColor}`,
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.12)',
        cursor: item.onClick ? 'pointer' : 'default',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: ringColor,
        flexShrink: 0,
      }}
    >
      <Avatar
        src={item.src || undefined}
        name={item.name}
        size={size}
      />
      <AvatarGroupTooltip>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, color: '#ffffff' }}>{item.name}</span>
            {item.badge && (
              <span
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'rgba(198, 51, 61, 0.28)',
                  color: '#fecdd3',
                  border: '1px solid rgba(251, 113, 133, 0.35)',
                }}
              >
                {item.badge}
              </span>
            )}
          </div>
          {item.subtitle && (
            <span style={{ fontSize: '0.66rem', fontWeight: 500, color: '#94a3b8' }}>
              {item.subtitle}
            </span>
          )}
        </div>
      </AvatarGroupTooltip>
    </div>
  ));

  if (overflowItems.length > 0) {
    const previewNames = overflowItems
      .slice(0, 5)
      .map((it) => it.name)
      .join(', ');
    const moreRest =
      overflowItems.length > 5 ? ` (+${overflowItems.length - 5} khác)` : '';

    childrenElements.push(
      <div
        key="__overflow_more__"
        style={{
          marginLeft: visibleItems.length === 0 ? 0 : overlap,
          width: size + 4,
          height: size + 4,
          borderRadius: '999px',
          background: '#f1f5f9',
          color: '#0f172a',
          fontWeight: 800,
          fontSize: size <= 22 ? '0.6rem' : size <= 28 ? '0.68rem' : '0.74rem',
          border: `2px solid ${ringColor}`,
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.12)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          userSelect: 'none',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        +{overflowItems.length}
        <AvatarGroupTooltip>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontWeight: 700, color: '#ffffff' }}>
              +{overflowItems.length} thành viên khác
            </span>
            <span style={{ fontSize: '0.66rem', fontWeight: 500, color: '#cbd5e1' }}>
              {previewNames}
              {moreRest}
            </span>
          </div>
        </AvatarGroupTooltip>
      </div>,
    );
  }

  return (
    <AvatarGroup
      className={className}
      style={style}
      invertOverlap={invertOverlap}
      translate={translate}
      side={side}
      sideOffset={sideOffset}
    >
      {childrenElements}
    </AvatarGroup>
  );
}

export {
  AvatarGroup,
  AvatarGroupTooltip,
  AvatarGroupTooltipArrow,
  AnimatedAvatarGroup,
  type AvatarGroupProps,
  type AvatarGroupTooltipProps,
  type AvatarGroupTooltipArrowProps,
};
