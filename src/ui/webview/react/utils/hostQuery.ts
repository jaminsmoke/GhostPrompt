import type { OutboundMessage } from "../types";

export function hostQuery<T>(
  msg: OutboundMessage,
  responseType: string,
  sendMessage: (m: OutboundMessage) => void,
): Promise<T> {
  return new Promise((resolve) => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === responseType) {
        window.removeEventListener("message", handler);
        resolve(e.data as T);
      }
    };
    window.addEventListener("message", handler);
    sendMessage(msg);
  });
}
