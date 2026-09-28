/**
 * Multi-Tab Real-time Synchronizer via HTML5 BroadcastChannel API
 * Instant cross-tab sync without triggering redundant network requests
 */

export type ChatBroadcastEvent =
  | { type: 'NEW_MESSAGE'; message: any }
  | { type: 'CONVERSATION_READ'; conversationId: number; userId: number; last_message_id?: number }
  | { type: 'CONVERSATIONS_UPDATED' }
  | { type: 'MESSAGE_EDITED'; messageId: number; content: string }
  | { type: 'MESSAGE_DELETED'; conversationId: number; messageId: number }
  | { type: 'PIN_UPDATED'; conversationId: number; pinnedInfo: any };

class ChatBroadcaster {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(event: ChatBroadcastEvent) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('myerp_workchat_bus');
        this.channel.onmessage = (e: MessageEvent<ChatBroadcastEvent>) => {
          if (e.data && e.data.type) {
            this.listeners.forEach((listener) => {
              try {
                listener(e.data);
              } catch (err) {
                console.error('Error in chat broadcast listener:', err);
              }
            });
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization skipped:', err);
      }
    }
  }

  public post(event: ChatBroadcastEvent): void {
    if (this.channel) {
      try {
        this.channel.postMessage(event);
      } catch (err) {}
    }
  }

  public subscribe(listener: (event: ChatBroadcastEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const chatBroadcaster = new ChatBroadcaster();
