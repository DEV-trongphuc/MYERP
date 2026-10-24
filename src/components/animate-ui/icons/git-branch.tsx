import * as React from 'react';
import { motion, type Variants } from 'framer-motion';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from './icon';

type GitBranchProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    branch: {
      initial: { pathLength: 1 },
      animate: {
        pathLength: [0.1, 1],
        transition: { duration: 0.65, ease: 'easeInOut' },
      },
    },
    node: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.25, 1],
        transition: { duration: 0.65, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: GitBranchProps) {
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
      <line x1="6" x2="6" y1="3" y2="15" />
      <motion.circle
        cx="18"
        cy="6"
        r="3"
        variants={variants.node}
        initial="initial"
        animate={controls}
      />
      <circle cx="6" cy="18" r="3" />
      <motion.path
        d="M18 9a9 9 0 0 1-9 9"
        variants={variants.branch}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function GitBranch(props: GitBranchProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  GitBranch,
  GitBranch as GitBranchIcon,
  type GitBranchProps,
  type GitBranchProps as GitBranchIconProps,
};
