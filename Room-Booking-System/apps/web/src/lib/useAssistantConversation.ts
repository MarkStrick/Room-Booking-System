import { useCallback, useEffect, useRef, useState } from 'react';
import { clearConversation, conversationExpired, freshConversation, loadConversation, saveConversation, ASSISTANT_IDLE_MS, type AssistantConversation, type ChatStorage } from './assistant-conversation';

function storage(): ChatStorage | undefined {
  try { return window.sessionStorage; } catch { return undefined; }
}
export function useAssistantConversation(owner: string, active: boolean) {
  const [snapshot,setSnapshot] = useState(() => loadConversation(storage(),owner));
  const currentRef = useRef(snapshot);
  if (currentRef.current.owner !== owner) currentRef.current = loadConversation(storage(),owner);
  const current = useCallback(() => {
    if (conversationExpired(currentRef.current)) {
      clearConversation(storage(),owner);
      currentRef.current = freshConversation(owner);
    }
    return currentRef.current;
  },[owner]);
  const update = useCallback((action: (chat: AssistantConversation) => AssistantConversation) => {
    const next = { ...action(current()), owner, lastActivityAt: Date.now() };
    currentRef.current = next;
    saveConversation(storage(),next);
    setSnapshot(next);
  },[current,owner]);
  const touch = useCallback(() => update(chat => chat),[update]);
  const clear = useCallback(() => {
    clearConversation(storage(),owner);
    const next = freshConversation(owner);
    currentRef.current = next; setSnapshot(next);
  },[owner]);
  useEffect(() => { setSnapshot(currentRef.current); },[owner]);
  // Entering or returning to the chat counts as activity. Background app polling does not.
  useEffect(() => {
    if (!active) return;
    touch();
    const resume = () => { if (document.visibilityState === 'visible') touch(); };
    window.addEventListener('focus',resume);
    document.addEventListener('visibilitychange',resume);
    return () => { window.removeEventListener('focus',resume); document.removeEventListener('visibilitychange',resume); };
  },[active,touch]);
  useEffect(() => {
    if (snapshot.owner !== owner || !snapshot.messages.length) return;
    const timer = setTimeout(() => {
      if (conversationExpired(currentRef.current)) clear();
    },Math.max(0,snapshot.lastActivityAt + ASSISTANT_IDLE_MS - Date.now()));
    return () => clearTimeout(timer);
  },[snapshot.owner,snapshot.messages.length,snapshot.lastActivityAt,owner,clear]);
  return { conversation: snapshot.owner === owner ? snapshot : currentRef.current, current, update, touch, clear };
}
