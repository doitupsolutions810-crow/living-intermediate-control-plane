import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_HISTORY_KEY,
  MAX_CONVERSATIONS,
  normalizeHistory,
  readHistory,
  writeHistory
} from '../lib/chat-history.mjs';

function conversation(id, sessionId, content = `${id} message`, updatedAt = '2026-01-01T00:00:00.000Z') {
  return {
    id,
    title: id,
    createdAt: updatedAt,
    updatedAt,
    latticeSessionId: sessionId,
    messages: [{ role: 'user', content }]
  };
}

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values
  };
}

test('history round-trips bounded conversations and keeps each LICP session with its chat', () => {
  const storage = createStorage();
  const chats = [
    conversation('chat-a', 'lattice-a'),
    conversation('chat-b', 'lattice-b', 'second', '2026-01-02T00:00:00.000Z')
  ];

  writeHistory(storage, chats);
  const restored = readHistory(storage);

  assert.equal(restored.invalidCount, 0);
  assert.equal(restored.conversations.length, 2);
  assert.equal(restored.conversations.find(chat => chat.id === 'chat-a').latticeSessionId, 'lattice-a');
  assert.equal(restored.conversations.find(chat => chat.id === 'chat-b').latticeSessionId, 'lattice-b');
  assert.equal(JSON.parse(storage.values.get(CHAT_HISTORY_KEY)).version, 1);
});

test('history rejects malformed records and excludes unsupported message roles', () => {
  const storage = createStorage();
  storage.setItem(
    CHAT_HISTORY_KEY,
    JSON.stringify({
      version: 1,
      conversations: [
        conversation('valid', 'session-1'),
        { id: 'invalid', messages: [{ role: 'system', content: 'must not load' }] }
      ]
    })
  );

  const restored = readHistory(storage);

  assert.equal(restored.invalidCount, 1);
  assert.deepEqual(restored.conversations.map(chat => chat.id), ['valid']);
  assert.equal(normalizeHistory({}).invalidCount, 1);
});

test('history retention is bounded and malformed storage can be reported', () => {
  const many = Array.from({ length: MAX_CONVERSATIONS + 4 }, (_, index) =>
    conversation(`chat-${index}`, null, `message-${index}`, new Date(index * 1000).toISOString())
  );
  const normalized = normalizeHistory(many);
  assert.equal(normalized.conversations.length, MAX_CONVERSATIONS);
  assert.equal(normalized.conversations[0].id, 'chat-23');

  const storage = createStorage();
  storage.setItem(CHAT_HISTORY_KEY, '{bad json');
  assert.equal(readHistory(storage).invalidCount, 1);
});
