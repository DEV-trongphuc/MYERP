import * as React from 'react';
import { motion, type Variants } from 'framer-motion';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from './icon';

type AwardProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: { rotate: 0, scale: 1 },
      animate: {
        rotate: [0, -8, 8, -4, 0],
        scale: [1, 1.1, 1],
        transition: { duration: 0.7, ease: 'easeInOut' },
      },
    },
    ribbon: {
      initial: { y: 0 },
      animate: {
        y: [0, 1.5, 0],
        transition: { duration: 0.7, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: AwardProps) {
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
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <circle cx="12" cy="8" r="6" />
        <motion.path
          d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"
          variants={variants.ribbon}
          initial="initial"
          animate={controls}
        />
      </motion.g>
    </motion.svg>
  );
}

function Award(props: AwardProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Award,
  Award as AwardIcon,
  type AwardProps,
  type AwardProps as AwardIconProps,
};
