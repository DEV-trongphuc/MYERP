import React from 'react';
export const HTML5Backend = {};
export const DndProvider: React.FC<{ backend?: any; children: React.ReactNode }> = ({ children }) => <>{children}</>;
export function useDrag<A = any, B = any, C = any>(specArg: any): [C, (el: any) => void, (el: any) => void] {
  const _spec = typeof specArg === 'function' ? specArg() : specArg;
  return [{ isDragging: false } as unknown as C, () => {}, () => {}];
}
export function useDrop<A = any, B = any, C = any>(specArg: any): [C, (el: any) => void] {
  const _spec = typeof specArg === 'function' ? specArg() : specArg;
  return [{ isOver: false, canDrop: true } as unknown as C, () => {}];
}
