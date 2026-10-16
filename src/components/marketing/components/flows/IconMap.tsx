

import React from 'react';
import { Zap, Mail, Clock, GitMerge, Tag, Split, Link, List } from 'lucide-react';

export const IconMap = {
  zap: Zap,
  mail: Mail,
  clock: Clock,
  'git-merge': GitMerge,
  tag: Tag,
  split: Split,
  link: Link,
  list: List
};

export type IconName = keyof typeof IconMap;

export const FlowIcon = ({ name, className }: { name: IconName; className?: string }) => {
  const IconComponent = IconMap[name] || GitMerge;
  return <IconComponent className={className} />;
};
// Dual value declarations for verbatimModuleSyntax compatibility
export const IconName: any = undefined;
