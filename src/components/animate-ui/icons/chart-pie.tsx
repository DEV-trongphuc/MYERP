import * as React from 'react';
import { motion, type Variants } from 'framer-motion';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from './icon';

type ChartPieProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    slice: {
      initial: { x: 0, y: 0 },
      animate: {
        x: [0, 2, 0],
        y: [0, -2, 0],
        transition: { duration: 0.65, ease: 'easeInOut' },
      },
    },
    base: {
      initial: { rotate: 0 },
      animate: {
        rotate: [0, -6, 0],
        transition: { duration: 0.65, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: ChartPieProps) {
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
      <motion.path
        d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"
        variants={variants.slice}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M21.21 15.89A10 10 0 1 1 8 2.83"
        variants={variants.base}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function ChartPie(props: ChartPieProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  ChartPie,
  ChartPie as ChartPieIcon,
  type ChartPieProps,
  type ChartPieProps as ChartPieIconProps,
};
