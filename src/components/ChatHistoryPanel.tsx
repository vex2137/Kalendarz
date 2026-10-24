import { useEffect, useRef, useState } from "react";
import type { AppLanguage } from "../utils/i18n";
import { assistantUiText } from "../utils/assistantUiText";
import {
  clearChatHistory,
  deleteChat,
  exportChatHistory,
  importChatHistory,
  listChats,
  renameChat,
  type ChatRecord,
} from "../utils/chatHistory";
import { AI_MODELS } from "../utils/modelRegistry";

export function ChatHistoryPanel({
  language,
  onClose,
  onSelect,
  onNew,
  onDeleted,
}: {
  language: AppLanguage;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDeleted: (id?: string) => void;
}) {
  const text = assistantUiText(language);
  const [chats, setChats] = useState<ChatRecord[]>([]),
    [query, setQuery] = useState(""),
    [limit, setLimit] = useState(100),
    [revision, setRevision] = useState(0);
  const [error, setError] = useState(false),
    [editing, setEditing] = useState<string>(),
    [title, setTitle] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void listChats(query, limit, controller.signal)
        .then((rows) => {
          if (current) setChats(rows);
        })
        .catch(() => {
          if (current) setError(true);
        });
    }, 120);
    return () => {
      current = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, limit, revision]);
  const perform = (action: () => Promise<void>) => {
    setError(false);
    void action()
      .then(() => setRevision((value) => value + 1))
      .catch(() => setError(true));
  };
  const exportJson = () =>
    perform(async () => {
      const data = await exportChatHistory();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "calendar-ai-history.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  return (
    <section
      className="h-full flex flex-col theme-surface theme-text"
      aria-label={text.conversations}
    >
      <header className="p-3 flex justify-between gap-2 theme-border border-b">
        <h3 className="font-semibold">{text.conversations}</h3>
        <button type="button" onClick={onClose} className="underline">
          {text.close}
        </button>
      </header>
      <div className="p-3 space-y-2">
        <button
          type="button"
          id="btn-new-history-chat"
          onClick={onNew}
          className="theme-primary px-3 py-2 rounded"
        >
          {text.newChat}
        </button>
        <input
          ref={input}
          type="search"
          aria-label={text.search}
          placeholder={text.search}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(100);
          }}
          className="w-full theme-input p-2 rounded"
        />
      </div>
      {error && (
        <p role="alert" className="p-3">
          {text.historyError}
        </p>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {chats.map((chat) => (
          <article
            key={chat.id}
            className="theme-border border rounded-lg p-3"
            data-chat-id={chat.id}
          >
            {editing === chat.id ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  perform(async () => {
                    await renameChat(chat.id, title);
                    setEditing(undefined);
                  });
                }}
              >
                <input
                  aria-label={text.rename}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  className="theme-input rounded p-2 w-full"
                />
                <button type="submit" className="underline p-2">
                  {text.save}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(undefined)}
                  className="underline p-2"
                >
                  {text.cancel}
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="font-semibold text-left break-words w-full"
                onClick={() => onSelect(chat.id)}
              >
                {chat.title}
              </button>
            )}
            <p className="text-xs theme-muted">
              {new Date(chat.updatedAt).toLocaleString(language)} ·{" "}
              {chat.modelIds.length
                ? chat.modelIds
                    .map(
                      (id) =>
                        AI_MODELS.find((model) => model.id === id)?.name || id,
                    )
                    .join(", ")
                : text.noModel}
            </p>
            <div className="flex gap-3 mt-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setEditing(chat.id);
                  setTitle(chat.title);
                }}
                className="underline"
              >
                {text.rename}
              </button>
              <button
                type="button"
                className="underline"
                onClick={() => {
                  if (window.confirm(text.confirmDelete))
                    perform(async () => {
                      await deleteChat(chat.id);
                      onDeleted(chat.id);
                    });
                }}
              >
                {text.delete}
              </button>
            </div>
          </article>
        ))}
        {chats.length === limit && (
          <button
            type="button"
            onClick={() => setLimit((value) => value + 100)}
            className="underline"
          >
            {text.loadMore}
          </button>
        )}
      </div>
      <footer className="p-3 flex flex-wrap gap-3 text-xs theme-border border-t">
        <button type="button" className="underline" onClick={exportJson}>
          {text.export}
        </button>
        <label className="underline cursor-pointer">
          {text.importHistory}
          <input
            type="file"
            className="sr-only"
            accept="application/json,.json"
            aria-label={text.importHistory}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file)
                perform(async () => {
                  if (file.size > 25 * 1024 * 1024)
                    throw new Error("chat-import-size");
                  await importChatHistory(await file.text());
                });
            }}
          />
        </label>
        <button
          type="button"
          className="underline"
          onClick={() => {
            if (window.confirm(text.confirmAll))
              perform(async () => {
                await clearChatHistory();
                onDeleted();
              });
          }}
        >
          {text.deleteAll}
        </button>
      </footer>
    </section>
  );
}
