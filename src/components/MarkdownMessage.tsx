import React from 'react';

interface MarkdownMessageProps {
  content: string;
  isUser?: boolean;
}

/**
 * Robust, lightweight Markdown parser tailored for calendar assistant messages.
 * Formats:
 * - **bold**
 * - *italic*
 * - `code`
 * - Bullet lists (•, -, *)
 * - Numbered lists (1., 2., etc.)
 * - Line breaks and paragraphs
 */
export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content, isUser = false }) => {
  // Split message into paragraphs/lines
  const lines = content.split('\n');

  // Helper to parse inline styles (**bold**, *italic*, `code`)
  const parseInline = (text: string): React.ReactNode[] => {
    // Regex matching **bold**, *italic*, `code`, or plain text
    // Using a capture group tokenizer
    const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, index) => {
      if (!part) return null;

      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        const inner = part.slice(2, -2);
        return (
          <strong
            key={index}
            className={isUser ? 'font-bold text-white' : 'font-bold theme-text underline-offset-2'}
          >
            {inner}
          </strong>
        );
      }

      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        const inner = part.slice(1, -1);
        return (
          <em
            key={index}
            className={isUser ? 'italic text-blue-100' : 'italic theme-text opacity-95'}
          >
            {inner}
          </em>
        );
      }

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

  // Group lines into blocks (paragraphs or lists)
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
                <span className="leading-relaxed">{parseInline(item)}</span>
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
                <span className="leading-relaxed">{parseInline(item)}</span>
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
      elements.push(<div key={`empty-${i}`} className="h-2" />);
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
      <p key={`line-${i}`} className="leading-relaxed">
        {parseInline(trimmed)}
      </p>
    );
  }

  flushList();

  return <div className="space-y-1">{elements}</div>;
};
