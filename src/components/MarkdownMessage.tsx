import React from 'react';

interface MarkdownMessageProps {
  content: string;
  isUser?: boolean;
}

/**
 * Robust, high-performance Markdown parser for AI assistant messages.
 * Formats:
 * - **bold** and __bold__
 * - *italic* and _italic_
 * - `code`
 * - # Headings (H1, H2, H3)
 * - Bullet lists (•, -, *)
 * - Numbered lists (1., 2., etc.)
 * - Line breaks and clean typography
 */
export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content, isUser = false }) => {
  // Pre-clean any accidental spaces inside markdown asterisks like * * text * *
  const cleanContent = content
    .replace(/\*\s+\*/g, '')
    .trim();

  // Helper to parse inline bold, italic, and code tokens
  const parseInline = (text: string): React.ReactNode[] => {
    // Matches **bold**, __bold__, *italic*, _italic_, `code`
    const regex = /(\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*[^*]+\*(?!\*)|(?<!_)_[^_]+_(?!_)|`[^`]+`)/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (!part) return null;

      // Bold (**text** or __text__)
      if ((part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
          (part.startsWith('__') && part.endsWith('__') && part.length >= 4)) {
        const inner = part.slice(2, -2);
        return (
          <strong
            key={index}
            className={isUser ? 'font-bold text-white' : 'font-bold theme-text'}
          >
            {parseInline(inner)}
          </strong>
        );
      }

      // Italic (*text* or _text_)
      if ((part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
          (part.startsWith('_') && part.endsWith('_') && part.length >= 2)) {
        const inner = part.slice(1, -1);
        return (
          <em
            key={index}
            className={isUser ? 'italic text-blue-100' : 'italic theme-text opacity-90'}
          >
            {inner}
          </em>
        );
      }

      // Inline code (`text`)
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        const inner = part.slice(1, -1);
        return (
          <code
            key={index}
            className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
              isUser ? 'bg-blue-700/60 text-white' : 'theme-subtle theme-border border text-blue-400'
            }`}
          >
            {inner}
          </code>
        );
      }

      return <span key={index}>{part}</span>;
    });
  };

  const lines = cleanContent.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'bullet' | 'ordered'; items: string[] } | null = null;

  const flushList = () => {
    if (currentList) {
      if (currentList.type === 'bullet') {
        elements.push(
          <ul key={`list-${elements.length}`} className="my-1.5 space-y-1 pl-1">
            {currentList.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`inline-block mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                  isUser ? 'bg-white/80' : 'bg-blue-500'
                }`} />
                <span className="leading-relaxed text-xs sm:text-sm">{parseInline(item)}</span>
              </li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`list-${elements.length}`} className="my-1.5 space-y-1 pl-1">
            {currentList.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`text-[11px] font-bold mt-0.5 shrink-0 ${
                  isUser ? 'text-blue-100' : 'text-blue-500'
                }`}>
                  {i + 1}.
                </span>
                <span className="leading-relaxed text-xs sm:text-sm">{parseInline(item)}</span>
              </li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushList();
      elements.push(<div key={`empty-${i}`} className="h-1.5" />);
      continue;
    }

    // Heading 1 (# Heading)
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h4 key={`h1-${i}`} className="text-sm sm:text-base font-bold theme-text mt-2 mb-1">
          {parseInline(trimmed.slice(2))}
        </h4>
      );
      continue;
    }

    // Heading 2 (## Heading)
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h5 key={`h2-${i}`} className="text-xs sm:text-sm font-bold theme-text mt-2 mb-0.5">
          {parseInline(trimmed.slice(3))}
        </h5>
      );
      continue;
    }

    // Heading 3 (### Heading)
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h6 key={`h3-${i}`} className="text-xs font-bold theme-text mt-1.5 mb-0.5">
          {parseInline(trimmed.slice(4))}
        </h6>
      );
      continue;
    }

    // Check bullet list item: •, -, or * at beginning of line
    const bulletMatch = rawLine.match(/^(\s*)(?:[•\-\*])\s+(.+)$/);
    if (bulletMatch) {
      const itemContent = bulletMatch[2];
      if (!currentList || currentList.type !== 'bullet') {
        flushList();
        currentList = { type: 'bullet', items: [] };
      }
      currentList.items.push(itemContent);
      continue;
    }

    // Check ordered list item: 1. 2. etc.
    const orderedMatch = rawLine.match(/^(\s*)\d+\.\s+(.+)$/);
    if (orderedMatch) {
      const itemContent = orderedMatch[2];
      if (!currentList || currentList.type !== 'ordered') {
        flushList();
        currentList = { type: 'ordered', items: [] };
      }
      currentList.items.push(itemContent);
      continue;
    }

    // Regular line
    flushList();
    elements.push(
      <p key={`line-${i}`} className="leading-relaxed text-xs sm:text-sm">
        {parseInline(trimmed)}
      </p>
    );
  }

  flushList();

  return <div className="space-y-1">{elements}</div>;
};
