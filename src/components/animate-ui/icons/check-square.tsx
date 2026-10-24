import * as React from 'react';
import { motion, type Variants } from 'framer-motion';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from './icon';

type CheckSquareProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    box: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 0.94, 1.04, 1],
        transition: { duration: 0.55, ease: 'easeInOut' },
      },
    },
    check: {
      initial: { pathLength: 1, opacity: 1 },
      animate: {
        pathLength: [0, 1],
        opacity: [0.4, 1],
        transition: { duration: 0.55, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: CheckSquareProps) {
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
        d="M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5"
        variants={variants.box}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="m9 11 3 3L22 4"
        variants={variants.check}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function CheckSquare(props: CheckSquareProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  CheckSquare,
  CheckSquare as CheckSquareIcon,
  type CheckSquareProps,
  type CheckSquareProps as CheckSquareIconProps,
};
