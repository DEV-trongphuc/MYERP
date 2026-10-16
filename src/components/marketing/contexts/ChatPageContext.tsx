import React, { createContext, useContext } from 'react';

export type OrgUser = Record<string, any>;
export const OrgUser: any = undefined;

const defaultChatPageContext: Record<string, any> = {
  bots: [],
  activeBot: null,
  setActiveBot: () => {},
  messages: [],
  setMessages: () => {},
  isSending: false,
  sendMessage: async () => {},
  currentUser: null,
  users: [],
  refreshUsers: async () => {},
};

export const ChatPageContext = createContext<any>(defaultChatPageContext);

export const ChatPageProvider: React.FC<{ children: React.ReactNode; value?: any }> = ({ children, value }) => (
  <ChatPageContext.Provider value={value || defaultChatPageContext}>{children}</ChatPageContext.Provider>
);

export function useChatPage(): any {
  return useContext(ChatPageContext) || defaultChatPageContext;
}
