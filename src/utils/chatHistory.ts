import { openDB } from "idb";
import type { AiChatMessage } from "../types";
import type { ModelConversation } from "./modelAssistant";

export interface ChatRecord {
  id: string;
  title: string;
  autoTitle: boolean;
  createdAt: number;
  updatedAt: number;
  modelIds: string[];
  selectedModelId?: string;
  context?: ModelConversation;
  nextSequence?: number;
}
export type StoredChatMessage = Pick<
  AiChatMessage,
  "id" | "role" | "content" | "timestamp" | "modelId" | "route" | "sequence" | "proposalSummary"
> & { chatId: string };
const db = () =>
  openDB("calendar-ai-chats", 1, {
    upgrade(database) {
      const chats = database.createObjectStore("chats", { keyPath: "id" });
      chats.createIndex("updated", ["updatedAt", "id"]);
      const messages = database.createObjectStore("messages", {
        keyPath: ["chatId", "id"],
      });
      messages.createIndex("order", ["chatId", "sequence", "id"]);
      messages.createIndex("chat", "chatId");
    },
  });
const activeKey = "calendar_active_chat_v1";
export const activeChatId = () => {
  try {
    return localStorage.getItem(activeKey);
  } catch {
    return null;
  }
};
export const rememberChat = (id: string) => {
  try {
    localStorage.setItem(activeKey, id);
  } catch {}
};
const cleanMessage = (
  message: AiChatMessage,
  chatId: string,
): StoredChatMessage => ({
  chatId,
  id: message.id,
  role: message.role,
  content: message.content,
  proposalSummary: message.proposalSummary || (message.suggestedPlan?.events || (message.suggestedEvent ? [message.suggestedEvent] : [])).map(event => [event.title, event.startDate, event.startTime, event.endDate, event.endTime].filter(Boolean).join(' · ')).join('\n') || undefined,
  timestamp: message.timestamp,
  ...(message.modelId ? { modelId: message.modelId } : {}),
  ...(message.route ? { route: message.route } : {}),
});
// Proposals/confirm buttons are deliberately not persisted: reopening is read-only
// until a new request is validated against the current calendar.
export async function createChat(
  title: string,
  modelId: string,
): Promise<ChatRecord> {
  const at = Date.now(),
    chat: ChatRecord = {
      id: crypto.randomUUID(),
      title,
      autoTitle: true,
      createdAt: at,
      updatedAt: at,
      modelIds: [],
      selectedModelId: modelId,
    };
  const database = await db();
  try {
    await database.put("chats", chat);
  } finally {
    database.close();
  }
  rememberChat(chat.id);
  return chat;
}
export async function getChat(id: string): Promise<ChatRecord | undefined> {
  const database = await db();
  try {
    return await database.get("chats", id);
  } finally {
    database.close();
  }
}
let initializing: Promise<ChatRecord> | undefined;
export function resolveActiveChat(
  title: string,
  modelId: string,
): Promise<ChatRecord> {
  if (!initializing)
    initializing = (async () => {
      const id = activeChatId();
      const selected = id ? await getChat(id) : undefined;
      return (
        selected ||
        (await listChats("", 1))[0] ||
        (await createChat(title, modelId))
      );
    })().finally(() => {
      initializing = undefined;
    });
  return initializing;
}
export async function saveChat(
  id: string,
  messages: AiChatMessage[],
  context: ModelConversation,
  selectedModelId: string,
) {
  const database = await db();
  try {
    const tx = database.transaction(["chats", "messages"], "readwrite", {
      durability: "strict",
    });
    const chat: ChatRecord | undefined = await tx.objectStore("chats").get(id);
    if (!chat) {
      await tx.done;
      return;
    } // A delayed save must never recreate a deleted chat.
    for (const message of messages) {
      const previous = await tx.objectStore("messages").get([id, message.id]);
      const sequence = previous?.sequence ?? chat.nextSequence ?? 0;
      if (!previous) chat.nextSequence = sequence + 1;
      await tx
        .objectStore("messages")
        .put({ ...cleanMessage(message, id), proposalSummary: cleanMessage(message,id).proposalSummary || previous?.proposalSummary, sequence });
    }
    const first = messages.find((message) => message.role === "user");
    if (chat.autoTitle && first) {
      chat.title = first.content.replace(/\s+/g, " ").slice(0, 80);
      chat.autoTitle = false;
    }
    chat.updatedAt = Math.max(
      chat.updatedAt,
      ...messages.map((message) => message.timestamp),
    );
    chat.modelIds = [
      ...new Set([
        ...chat.modelIds,
        ...messages
          .filter((m) => m.route === "model" && m.modelId)
          .map((m) => m.modelId!),
      ]),
    ];
    chat.selectedModelId = selectedModelId;
    chat.context = structuredClone(context);
    // Live proposals are not restored after a restart or chat switch.
    delete chat.context.proposal;
    await tx.objectStore("chats").put(chat);
    await tx.done;
  } finally {
    database.close();
  }
}
export async function chatMessages(
  id: string,
  before?: { sequence?: number; id: string },
  limit = 200,
): Promise<AiChatMessage[]> {
  const database = await db();
  try {
    const anchor = before && before.sequence === undefined ? await database.get('messages',[id,before.id]) : before;
    if (before && !anchor) return [];
    const range = IDBKeyRange.bound(
      [id, 0, ""],
      [id, anchor?.sequence ?? Number.MAX_SAFE_INTEGER, anchor?.id ?? "\uffff"],
      false,
      Boolean(before),
    );
    const result: AiChatMessage[] = [];
    let cursor = await database
      .transaction("messages")
      .store.index("order")
      .openCursor(range, "prev");
    while (cursor && result.length < limit) {
      const { chatId, ...message } = cursor.value;
      result.push(message);
      cursor = await cursor.continue();
    }
    return result.reverse();
  } finally {
    database.close();
  }
}
export async function listChats(
  query = "",
  limit = 100,
  signal?: AbortSignal,
): Promise<ChatRecord[]> {
  const database = await db();
  try {
    const term = query.normalize("NFC").toLocaleLowerCase();
    const matched = new Set<string>();
    if (term) {
      let cursor = await database.transaction("messages").store.openCursor();
      while (cursor) {
        if (signal?.aborted) return [];
        if (
          cursor.value.content
            .normalize("NFC")
            .toLocaleLowerCase()
            .includes(term)
        )
          matched.add(cursor.value.chatId);
        cursor = await cursor.continue();
      }
    }
    const result: ChatRecord[] = [];
    let cursor = await database
      .transaction("chats")
      .store.index("updated")
      .openCursor(undefined, "prev");
    while (cursor && result.length < limit) {
      if (signal?.aborted) return [];
      const chat = cursor.value;
      if (
        !term ||
        matched.has(chat.id) ||
        chat.title.normalize("NFC").toLocaleLowerCase().includes(term)
      )
        result.push(chat);
      cursor = await cursor.continue();
    }
    return result;
  } finally {
    database.close();
  }
}
export async function renameChat(id: string, title: string) {
  const value = title.trim().slice(0, 120);
  if (!value) throw new Error("chat-title");
  const database = await db();
  try {
    const tx = database.transaction("chats", "readwrite");
    const chat = await tx.store.get(id);
    if (chat) await tx.store.put({ ...chat, title: value, autoTitle: false });
    await tx.done;
  } finally {
    database.close();
  }
}
export async function deleteChat(id: string) {
  const database = await db();
  try {
    const tx = database.transaction(["chats", "messages"], "readwrite");
    await tx.objectStore("chats").delete(id);
    let cursor = await tx
      .objectStore("messages")
      .index("chat")
      .openCursor(IDBKeyRange.only(id));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  } finally {
    database.close();
  }
}
export async function clearChatHistory() {
  const database = await db();
  try {
    const tx = database.transaction(["chats", "messages"], "readwrite");
    await tx.objectStore("chats").clear();
    await tx.objectStore("messages").clear();
    await tx.done;
  } finally {
    database.close();
  }
  try {
    localStorage.removeItem(activeKey);
  } catch {}
}
export async function exportChatHistory() {
  const database = await db();
  try {
    return {
      version: 1,
      chats: await database.getAll("chats"),
      messages: await database.getAll("messages"),
    };
  } finally {
    database.close();
  }
}
export async function importChatHistory(text: string) {
  if (text.length > 25 * 1024 * 1024) throw new Error("chat-import-size");
  const data = JSON.parse(text);
  if (
    data?.version !== 1 ||
    !Array.isArray(data.chats) ||
    !Array.isArray(data.messages) ||
    data.chats.length > 10000 ||
    data.messages.length > 100000
  )
    throw new Error("chat-import-format");
  const ids = new Map<string, string>(),
    chats: ChatRecord[] = [],
    messages: StoredChatMessage[] = [];
  for (const chat of data.chats) {
    if (
      typeof chat.id !== "string" ||
      ids.has(chat.id) ||
      typeof chat.title !== "string" ||
      chat.title.length > 120 ||
      !Number.isSafeInteger(chat.createdAt) ||
      !Number.isSafeInteger(chat.updatedAt) ||
      chat.createdAt < 0 ||
      chat.updatedAt < 0
    )
      throw new Error("chat-import-record");
    const id = crypto.randomUUID();
    ids.set(chat.id, id);
    chats.push({
      id,
      title: chat.title,
      autoTitle: false,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      modelIds: Array.isArray(chat.modelIds)
        ? chat.modelIds
            .filter((m: unknown) => typeof m === "string")
            .slice(0, 20)
        : [],
    });
  }
  const sequences = new Map<string, number>();
  for (const message of [...data.messages].sort((a, b) =>
    a.chatId === b.chatId
      ? Number.isSafeInteger(a.sequence) && Number.isSafeInteger(b.sequence)
        ? a.sequence - b.sequence
        : a.timestamp - b.timestamp
      : String(a.chatId).localeCompare(String(b.chatId)),
  )) {
    const chatId = ids.get(message.chatId);
    if (
      !chatId ||
      !["user", "assistant", "system"].includes(message.role) ||
      typeof message.content !== "string" ||
      message.content.length > 12000 ||
      !Number.isSafeInteger(message.timestamp) ||
      message.timestamp < 0
    )
      throw new Error("chat-import-message");
    // Imported files cannot inject a system instruction into inference history.
    if (message.role === "system") continue;
    const sequence = sequences.get(chatId) || 0;
    sequences.set(chatId, sequence + 1);
    messages.push({
      chatId,
      id: crypto.randomUUID(),
      sequence,
      role: message.role,
      content: message.content,
      ...(typeof message.proposalSummary === 'string' ? {proposalSummary: message.proposalSummary.slice(0,12000)} : {}),
      timestamp: message.timestamp,
      ...(typeof message.modelId === "string"
        ? { modelId: message.modelId.slice(0, 100) }
        : {}),
    });
  }
  const database = await db();
  try {
    const tx = database.transaction(["chats", "messages"], "readwrite");
    for (const chat of chats)
      await tx
        .objectStore("chats")
        .put({ ...chat, nextSequence: sequences.get(chat.id) || 0 });
    for (const message of messages)
      await tx.objectStore("messages").put(message);
    await tx.done;
  } finally {
    database.close();
  }
}
