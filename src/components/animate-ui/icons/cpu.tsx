import * as React from 'react';
import { motion, type Variants } from 'framer-motion';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from './icon';

type CpuProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    core: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.18, 0.95, 1],
        transition: { duration: 0.6, ease: 'easeInOut' },
      },
    },
    pins: {
      initial: { opacity: 1 },
      animate: {
        opacity: [1, 0.45, 1],
        transition: { duration: 0.6, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: CpuProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="16" height="16" x="4" y="4" rx="2" />
      <motion.rect
        width="6"
        height="6"
        x="9"
        y="9"
        rx="1"
        variants={variants.core}
        initial="initial"
        animate={controls}
      />
      <motion.g variants={variants.pins} initial="initial" animate={controls}>
        <path d="M15 2v2" />
        <path d="M15 20v2" />
        <path d="M2 15h2" />
        <path d="M2 9h2" />
        <path d="M20 15h2" />
        <path d="M20 9h2" />
        <path d="M9 2v2" />
        <path d="M9 20v2" />
      </motion.g>
    </motion.svg>
  );
}

function Cpu(props: CpuProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Cpu,
  Cpu as CpuIcon,
  type CpuProps,
  type CpuProps as CpuIconProps,
};
