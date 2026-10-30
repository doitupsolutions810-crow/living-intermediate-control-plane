export const CHAT_HISTORY_KEY = 'avrone.chat-history.v1';
export const MAX_CONVERSATIONS = 20;
export const MAX_MESSAGES_PER_CONVERSATION = 60;
export const MAX_MESSAGE_LENGTH = 12_000;
export const MAX_TOTAL_CONTENT_LENGTH = 500_000;

function validDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export function conversationTitle(messages) {
  const firstUserMessage = messages.find(message => message.role === 'user')?.content?.trim();
  return firstUserMessage
    ? firstUserMessage.slice(0, 64) + (firstUserMessage.length > 64 ? '…' : '')
    : 'New chat';
}

function normalizeMessage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const role = value.role;
  if (role !== 'user' && role !== 'assistant') return null;
  if (typeof value.content !== 'string') return null;
  return {
    role,
    content: value.content.slice(-MAX_MESSAGE_LENGTH),
    ...(value.status === 'stopped' ? { status: 'stopped' } : {})
  };
}

function normalizeConversation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (typeof value.id !== 'string' || !value.id.trim() || value.id.length > 120) return null;
  if (!validDate(value.createdAt) || !validDate(value.updatedAt)) return null;
  if (!Array.isArray(value.messages)) return null;
  const messages = value.messages
    .map(normalizeMessage)
    .filter(Boolean)
    .slice(-MAX_MESSAGES_PER_CONVERSATION);
  const title =
    typeof value.title === 'string' && value.title.trim()
      ? value.title.trim().slice(0, 80)
      : conversationTitle(messages);
  const latticeSessionId =
    typeof value.latticeSessionId === 'string' && value.latticeSessionId.length <= 256
      ? value.latticeSessionId
      : null;
  return {
    id: value.id,
    title,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    latticeSessionId,
    messages
  };
}

export function normalizeHistory(value) {
  if (!Array.isArray(value)) return { conversations: [], invalidCount: 1 };
  let invalidCount = 0;
  const valid = value
    .map(item => {
      const conversation = normalizeConversation(item);
      if (!conversation) invalidCount++;
      return conversation;
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, MAX_CONVERSATIONS);

  let remainingContent = MAX_TOTAL_CONTENT_LENGTH;
  const conversations = valid.map(conversation => {
    const retainedReversed = [];
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      const message = conversation.messages[i];
      if (!remainingContent) break;
      const content = message.content.slice(-remainingContent);
      remainingContent -= content.length;
      retainedReversed.push({ ...message, content });
    }
    return {
      ...conversation,
      messages: retainedReversed.reverse()
    };
  });
  return { conversations, invalidCount };
}

export function readHistory(storage, key = CHAT_HISTORY_KEY) {
  const raw = storage.getItem(key);
  if (raw === null) return { conversations: [], invalidCount: 0 };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { conversations: [], invalidCount: 1 };
  }
  if (!parsed || parsed.version !== 1) {
    return { conversations: [], invalidCount: 1 };
  }
  return normalizeHistory(parsed.conversations);
}

export function writeHistory(storage, conversations, key = CHAT_HISTORY_KEY) {
  const normalized = normalizeHistory(conversations).conversations;
  storage.setItem(key, JSON.stringify({ version: 1, conversations: normalized }));
  return normalized;
}
