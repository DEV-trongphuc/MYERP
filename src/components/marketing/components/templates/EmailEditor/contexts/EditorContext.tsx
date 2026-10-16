// components/templates/EmailEditor/contexts/EditorContext.tsx
import React, { createContext, useContext } from 'react';
import { EmailBlock } from '../../../../types';

interface EditorContextValue {
    usedColors: string[];
    onUpdateBlock?: (id: string, data: Partial<EmailBlock>) => void;
}

const EditorContext = createContext<EditorContextValue>({ usedColors: [] });

export const EditorContextProvider = EditorContext.Provider;

export const useEditorContext = () => useContext(EditorContext);

export default EditorContext;
