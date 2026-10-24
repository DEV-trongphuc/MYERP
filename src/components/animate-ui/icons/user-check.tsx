import * as React from 'react';
import { motion, type Variants } from 'framer-motion';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from './icon';

type UserCheckProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    check: {
      initial: { pathLength: 1, scale: 1 },
      animate: {
        pathLength: [0, 1],
        scale: [0.9, 1.12, 1],
        transition: { duration: 0.6, ease: 'easeInOut' },
      },
    },
    head: {
      initial: { y: 0 },
      animate: {
        y: [0, -1.5, 0],
        transition: { duration: 0.55, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: UserCheckProps) {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <motion.circle
        cx="9"
        cy="7"
        r="4"
        variants={variants.head}
        initial="initial"
        animate={controls}
      />
      <motion.polyline
        points="16 11 18 13 22 9"
        variants={variants.check}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function UserCheck(props: UserCheckProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  UserCheck,
  UserCheck as UserCheckIcon,
  type UserCheckProps,
  type UserCheckProps as UserCheckIconProps,
};
