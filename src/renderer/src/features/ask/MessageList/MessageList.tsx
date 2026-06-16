import { useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { AskContext, AskMessage } from '@shared/types/models';
import { getModelDisplayName } from '@shared/constants/modelOptions';
import { copyToClipboard } from '@renderer/utils/clipboard';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: AskMessage[];
  activeContext: AskContext | null;
  isStreaming: boolean;
}

export default function MessageList({ messages, activeContext, isStreaming }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    if (autoScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 60;
    autoScrollRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  const copyText = useCallback((text: string) => {
    void copyToClipboard(text);
  }, []);

  const extractCodeBlocks = useCallback((content: string) => {
    const blocks: string[] = [];
    const regex = /```(?:[a-zA-Z0-9_+-]+)?\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null = regex.exec(content);

    while (match) {
      const code = (match[1] ?? '').trimEnd();
      if (code) {
        blocks.push(code);
      }
      match = regex.exec(content);
    }

    return blocks;
  }, []);

  return (
    <div className={styles.askMessages} ref={messagesContainerRef} onScroll={handleScroll}>
      {!activeContext && messages.length === 0 ? (
        <div className={styles.askEmpty}>
          <div className={styles.askEmptyIcon}>
            <i className="fa-solid fa-comments" aria-hidden="true" />
          </div>
          <div>Create a new conversation or type a question below.</div>
        </div>
      ) : (
        messages.map((msg, index) => {
          const promptModelName = msg.role === 'assistant'
            ? (msg.modelName ?? messages[index - 1]?.modelName)
            : msg.modelName;

          return (
          <div
            key={`${index}-${msg.role}`}
            className={msg.role === 'user' ? styles.askBubbleUser : styles.askBubbleAssistant}
          >
            <div className={styles.askBubbleHeader}>
              <span>
                {msg.role === 'user'
                  ? `You${promptModelName ? ` · ${getModelDisplayName(promptModelName)}` : ''}`
                  : `Copilot${promptModelName ? ` · ${getModelDisplayName(promptModelName)}` : ''}`}
              </span>
              {msg.role === 'assistant' && msg.content && (
                <div className={styles.askHeaderActions}>
                  <button
                    className={styles.askCopyBtn}
                    onClick={() => { void copyText(msg.content); }}
                    title="Copy response"
                    aria-label="Copy response"
                  >
                    <i className="fa-regular fa-copy" aria-hidden="true" />
                  </button>
                  <button
                    className={styles.askCopyBtn}
                    onClick={() => {
                      const codeBlocks = extractCodeBlocks(msg.content);
                      void copyText(codeBlocks.join('\n\n'));
                    }}
                    title="Copy code blocks"
                    aria-label="Copy code blocks"
                    disabled={extractCodeBlocks(msg.content).length === 0}
                  >
                    <i className="fa-solid fa-code" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
            <div className={styles.askBubbleContent}>
              {msg.role === 'assistant' ? (
                msg.content ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  isStreaming && index === messages.length - 1 && (
                    <span className={styles.askStreamingCursor} />
                  )
                )
              ) : (
                <div className={styles.askUserText}>{msg.content}</div>
              )}
              {msg.role === 'assistant' && isStreaming && index === messages.length - 1 && msg.content && (
                <span className={styles.askStreamingCursor} />
              )}
            </div>
          </div>
        );})
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
