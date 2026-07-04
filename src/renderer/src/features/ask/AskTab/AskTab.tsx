import { useCallback, useEffect, useRef, useState } from 'react';
import { AskContext, AskMessage } from '@shared/types/models';
import { normalizeSelectableModelId } from '@shared/constants/modelOptions';
import { api } from '@renderer/services/api';
import { useSpeechRecognition } from '@renderer/features/ask/hooks/useSpeechRecognition';
import { useResizeDrag } from '@renderer/hooks/useResizeDrag';
import { useByokModelLock } from '@renderer/hooks/useByokModelLock';
import ModelSelect from '@renderer/features/shared/ModelSelect/ModelSelect';
import ContextBar from '../ContextBar/ContextBar';
import MessageList from '../MessageList/MessageList';
import { LABELS } from './AskTab.messages';
import styles from './AskTab.module.css';

interface AskTabProps {
  modelOptions: { id: string; label: string; disabled?: boolean }[];
  defaultModel: string;
  modelCatalogUnavailableMessage?: string;
  initialMessage?: string;
  onInitialMessageConsumed?: () => void;
}

export default function AskTab({
  modelOptions,
  defaultModel,
  modelCatalogUnavailableMessage,
  initialMessage,
  onInitialMessageConsumed
}: AskTabProps) {
  const [contexts, setContexts] = useState<AskContext[]>([]);
  const [activeContextId, setActiveContextId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [modelName, setModelName] = useState(normalizeSelectableModelId(defaultModel));
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputAreaHeight, setInputAreaHeight] = useState(160);
  const [hasManualInputResize, setHasManualInputResize] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputAreaRef = useRef<HTMLDivElement | null>(null);
  const isCreatingContextRef = useRef(false);
  const modelNameRef = useRef(modelName);
  const inputAreaMinHeight = 140;
  const inputAreaMaxAuto = 320;
  const inputAreaExtra = 92;

  const { isListening, isSpeechSupported, speechError, startListening, stopListening } = useSpeechRecognition();
  const activeContext = contexts.find((c) => c.id === activeContextId) ?? null;

  // ── BYOK lock logic ────────────────────────────────────────────────
  const { filteredModelOptions, disabled, disabledMessage } = useByokModelLock({
    contextModelName: activeContext?.modelName ?? modelName,
    hasMessages: (activeContext?.messages.length ?? 0) > 0,
    modelOptions,
    lockMessage: LABELS.modelLockedByok
  });

  useEffect(() => {
    modelNameRef.current = modelName;
  }, [modelName]);

  const createContext = useCallback(async () => {
    if (isCreatingContextRef.current) {
      return;
    }
    isCreatingContextRef.current = true;
    try {
      const ctx = await api.createAskContext(undefined, modelNameRef.current);
      setContexts((prev) => [...prev, ctx]);
      setIsStreaming(false);
      setActiveContextId(ctx.id);
      setMessages([]);
      inputRef.current?.focus();
    } catch { /* noop */ }
    finally {
      isCreatingContextRef.current = false;
    }
  }, []);

  useEffect(() => {
    setModelName(normalizeSelectableModelId(defaultModel));
  }, [defaultModel]);

  useEffect(() => {
    if (!initialMessage) return;
    setInputText(initialMessage);
    onInitialMessageConsumed?.();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [initialMessage, onInitialMessageConsumed]);

  useEffect(() => {
    api.getAskContexts().then((loaded) => {
      if (loaded.length > 0) {
        setContexts(loaded);
        setActiveContextId(loaded[0].id);
        return;
      }
      void createContext();
    }).catch(() => {});
  }, [createContext]);

  useEffect(() => {
    if (contexts.length === 0) {
      void createContext();
    }
  }, [contexts.length, createContext]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    if (!hasManualInputResize) {
      const nextHeight = Math.min(
        inputAreaMaxAuto,
        Math.max(inputAreaMinHeight, scrollHeight + inputAreaExtra)
      );
      if (nextHeight !== inputAreaHeight) {
        setInputAreaHeight(nextHeight);
      }
    }
    const maxTextareaHeight = Math.max(40, inputAreaHeight - inputAreaExtra);
    const targetHeight = hasManualInputResize
      ? maxTextareaHeight
      : Math.min(scrollHeight, maxTextareaHeight);
    textarea.style.height = `${targetHeight}px`;
  }, [inputText, inputAreaHeight, hasManualInputResize]);

  useEffect(() => {
    setIsStreaming(false);
    if (!activeContextId) { setMessages([]); return; }
    // Sync model selector with the active context's model so the BYOK lock
    // follows context switches (context A uses BYOK → selector locks;
    // switch to context B with non-BYOK → selector unlocks).
    // Use activeContext?.modelName (string) instead of activeContext (object)
    // in deps — activeContext is derived from contexts.find() and changes
    // reference on every render, which would reset user's model selection.
    setModelName(normalizeSelectableModelId(activeContext?.modelName ?? null));
    api.getAskMessages(activeContextId).then((loadedMessages) => {
      setMessages(loadedMessages);
      // Sync contexts so activeContext.messages reflects persisted state for the BYOK lock.
      if (loadedMessages.length > 0) {
        setContexts((prev) => prev.map((c) =>
          c.id === activeContextId ? { ...c, messages: loadedMessages } : c
        ));
      }
    }).catch(() => {});
  }, [activeContextId, activeContext?.modelName]);

  useEffect(() => {
    const unsubDelta = api.onAskDelta((payload) => {
      if (payload.contextId !== activeContextId) return;
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant') {
          copy[copy.length - 1] = { ...last, content: payload.fullText };
        }
        return copy;
      });
      setIsStreaming(true);
    });

    const unsubComplete = api.onAskMessageComplete((payload) => {
      if (payload.contextId !== activeContextId) return;
      setIsStreaming(false);
      api.getAskMessages(payload.contextId).then(setMessages).catch(() => {});
    });

    return () => { unsubDelta(); unsubComplete(); };
  }, [activeContextId]);

  const sendMessage = async () => {
    if (!inputText.trim() || isStreaming) return;

    let contextId = activeContextId;
    if (!contextId) {
      try {
        const ctx = await api.createAskContext(undefined, modelName);
        setContexts((prev) => [...prev, ctx]);
        setActiveContextId(ctx.id);
        contextId = ctx.id;
      } catch { return; }
    }

    const userText = inputText.trim();
    setInputText('');

    const userMsg: AskMessage = { role: 'user', content: userText, timestamp: new Date().toISOString(), modelName };
    const assistantMsg: AskMessage = { role: 'assistant', content: '', timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    // Immediately sync the context's modelName and messages so the BYOK lock
    // (isFullyLocked / isPartiallyLocked) takes effect before the response arrives.
    setContexts((prev) => prev.map((c) => {
      if (c.id !== contextId) return c;
      return { ...c, modelName, messages: [...c.messages, userMsg] };
    }));
    setIsStreaming(true);

    try {
      await api.sendAskMessage(contextId, userText, modelName);
    }
    catch {
      setIsStreaming(false);
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          copy.pop();
        }
        return copy;
      });
    }
  };

  const cancelMessage = async () => {
    if (!activeContextId) return;
    try { await api.cancelAskMessage(activeContextId); } catch { /* noop */ }
    setIsStreaming(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && event.ctrlKey) { event.preventDefault(); void sendMessage(); }
  };

  // Ctrl+Tab / Ctrl+Shift+Tab: cycle through chat contexts (global within tab)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !event.ctrlKey) return;
      const currentIndex = contexts.findIndex((c) => c.id === activeContextId);
      if (currentIndex === -1) return;
      event.preventDefault();
      const direction = event.shiftKey ? -1 : 1;
      const nextIndex = (currentIndex + direction + contexts.length) % contexts.length;
      if (contexts[nextIndex]) {
        setIsStreaming(false);
        setActiveContextId(contexts[nextIndex].id);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [contexts, activeContextId]);

  const handleTranscript = (text: string) => {
    setInputText((prev) => {
      const separator = prev.trim().length > 0 ? ' ' : '';
      return `${prev}${separator}${text}`;
    });
    inputRef.current?.focus();
  };

  const startResizeInputArea = useResizeDrag({
    direction: 'vertical',
    startSize: inputAreaHeight,
    minSize: inputAreaMinHeight,
    maxSize: panelRef.current
      ? Math.max(panelRef.current.clientHeight - 200, inputAreaMinHeight)
      : 360,
    onResize: (size) => {
      setHasManualInputResize(true);
      setInputAreaHeight(size);
    }
  });

  return (
    <div className={styles.askPanel} ref={panelRef}>
      <ContextBar
        contexts={contexts}
        activeContextId={activeContextId}
        onSelectContext={(id) => {
          setIsStreaming(false);
          setActiveContextId(id || null);
        }}
        onContextsChange={setContexts}
        onCreateContext={createContext}
      />

      <MessageList
        messages={messages}
        activeContext={activeContext}
        isStreaming={isStreaming}
      />

      <div
        className={styles.askInputSplitter}
        onMouseDown={(event) => {
          setHasManualInputResize(true);
          startResizeInputArea(event);
        }}
      />
      <div className={styles.askInputArea} ref={inputAreaRef} style={{ height: inputAreaHeight }}>
        <div className={styles.askInputRow}>
          <ModelSelect
            value={modelName}
            options={filteredModelOptions}
            onChange={(next) => setModelName(normalizeSelectableModelId(next))}
            className={`model-select ${styles.askModelSelect}`}
            unavailableMessage={modelCatalogUnavailableMessage ?? LABELS.modelCatalogUnavailable}
            keyPrefix="ask-tab"
            disabled={disabled}
            disabledMessage={disabledMessage}
          />
        </div>
        <div className={`${styles.askInputRow} ${styles.askInputMain}`}>
          <textarea
            ref={inputRef}
            className={styles.askTextarea}
            placeholder={LABELS.inputPlaceholder}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            disabled={isStreaming}
          />
          <div className={styles.askInputButtons}>
            <button
              className={`btn ${isListening ? 'btn-blue' : ''}`}
              onClick={() => { if (isListening) { stopListening(); return; } void startListening(handleTranscript); }}
              title={isListening ? LABELS.stopMicrophone : LABELS.useMicrophone}
              aria-label={isListening ? LABELS.stopMicrophone : LABELS.useMicrophone}
              disabled={!isSpeechSupported || isStreaming}
            >
              <i className={`fa-solid ${isListening ? 'fa-microphone-slash' : 'fa-microphone'}`} aria-hidden="true" />
            </button>
            {isStreaming ? (
              <button className="btn btn-danger" onClick={cancelMessage} title={LABELS.cancel}>
                <i className="fa-solid fa-stop" aria-hidden="true" />
              </button>
            ) : (
              <button className="btn accent" onClick={sendMessage} disabled={!inputText.trim()} title={LABELS.send}>
                <i className="fa-solid fa-paper-plane" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {speechError && <div className={styles.askSpeechError}>{speechError}</div>}
      </div>
    </div>
  );
}
