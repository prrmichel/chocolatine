import { EventEmitter } from 'events';
import { CopilotReviewService } from '@main/core/copilot/copilotReviewService';
import { CopilotSessionManager } from '@main/core/copilot/copilotSessionManager';
import { AskContext, AskMessage } from '@shared/types/models';
import { IpcChannels } from '@shared/constants/ipcChannels';
import { COPILOT_TIMEOUT_MS } from '@shared/constants/timeouts';
import { getFallbackFreeModelId, normalizeModelId, normalizeSelectableModelId } from '@shared/constants/modelOptions';

export class AskService extends EventEmitter {
  private readonly contexts = new Map<string, AskContext>();
  private readonly controllers = new Map<string, AbortController>();

  constructor(
    private readonly copilotService: CopilotReviewService,
    private readonly sessionManager?: CopilotSessionManager
  ) {
    super();
  }

  createContext(name?: string, modelName?: string): AskContext {
    const id = `ask-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const context: AskContext = {
      id,
      name: name || `Chat ${this.contexts.size + 1}`,
      modelName: normalizeSelectableModelId(modelName ?? getFallbackFreeModelId()),
      messages: [],
      isStreaming: false,
      createdAt: new Date().toISOString()
    };
    this.contexts.set(id, context);
    return context;
  }

  deleteContext(contextId: string): void {
    this.cancelMessage(contextId);
    this.contexts.delete(contextId);
    // Clean up the persistent Copilot session
    if (this.sessionManager) {
      void this.sessionManager.deleteSession(CopilotSessionManager.askKey(contextId));
    }
  }

  renameContext(contextId: string, name: string): AskContext | null {
    const context = this.contexts.get(contextId);
    if (!context) {
      return null;
    }
    context.name = name;
    return context;
  }

  getContexts(): AskContext[] {
    return Array.from(this.contexts.values());
  }

  getMessages(contextId: string): AskMessage[] {
    return this.contexts.get(contextId)?.messages ?? [];
  }

  cancelMessage(contextId: string): void {
    const controller = this.controllers.get(contextId);
    if (controller) {
      controller.abort();
      this.controllers.delete(contextId);
    }
    const context = this.contexts.get(contextId);
    if (context) {
      context.isStreaming = false;
    }
  }

  async sendMessage(contextId: string, userMessage: string, modelName?: string): Promise<string> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found.`);
    }
    if (!userMessage.trim()) {
      throw new Error('Message is empty.');
    }

    if (modelName) {
      context.modelName = normalizeSelectableModelId(modelName);
    }

    const userMsg: AskMessage = {
      role: 'user',
      content: userMessage.trim(),
      timestamp: new Date().toISOString(),
      modelName: normalizeSelectableModelId(context.modelName)
    };
    context.messages.push(userMsg);

    const assistantMsg: AskMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString()
    };
    context.messages.push(assistantMsg);
    context.isStreaming = true;

    // Use persistent session if available — only send the current user message
    // (the SDK session remembers prior turns natively).
    // Fall back to the legacy full-prompt approach if no session manager.
    const sessionKey = this.sessionManager
      ? CopilotSessionManager.askKey(contextId)
      : undefined;

    const promptToSend = sessionKey
      ? (context.messages.length <= 2
          ? this.buildSystemPreamble() + '\n\n' + userMessage.trim()
          : userMessage.trim())
      : this.buildConversationPrompt(context);

    const controller = new AbortController();
    this.controllers.set(contextId, controller);

    try {
      const response = await this.copilotService.requestReview(
        promptToSend,
        context.modelName,
        {
          onDelta: (delta, fullText) => {
            assistantMsg.content = fullText;
            this.emit(IpcChannels.ASK_DELTA, { contextId, delta, fullText });
          },
          onModelUsed: (actualModel) => {
            const normalizedModel = normalizeModelId(actualModel, { allowAuto: false, fallback: 'none' }) ?? actualModel;
            assistantMsg.modelName = normalizedModel;
          },
          signal: controller.signal,
          timeoutMs: COPILOT_TIMEOUT_MS,
          sessionKey
        }
      );

      assistantMsg.content = response;
      assistantMsg.timestamp = new Date().toISOString();
      context.isStreaming = false;
      this.controllers.delete(contextId);
      this.emit(IpcChannels.ASK_MESSAGE_COMPLETE, { contextId });
      return response;
    } catch (error: any) {
      context.isStreaming = false;
      this.controllers.delete(contextId);

      if (controller.signal.aborted) {
        if (!assistantMsg.content) {
          context.messages.pop();
        }
        this.emit(IpcChannels.ASK_MESSAGE_COMPLETE, { contextId });
        throw new Error('Request canceled.');
      }

      assistantMsg.content = `Error: ${error?.message ?? String(error)}`;
      this.emit(IpcChannels.ASK_MESSAGE_COMPLETE, { contextId });
      throw error;
    }
  }

  private buildConversationPrompt(context: AskContext): string {
    const parts: string[] = [
      this.buildSystemPreamble(),
      ''
    ];

    for (const msg of context.messages) {
      if (msg.role === 'user') {
        parts.push(`User: ${msg.content}`);
      } else if (msg.role === 'assistant' && msg.content) {
        parts.push(`Assistant: ${msg.content}`);
      }
    }

    // The last message is the empty assistant placeholder; remove it from prompt
    if (parts[parts.length - 1] === 'Assistant: ') {
      parts.pop();
    }

    return parts.join('\n');
  }

  private buildSystemPreamble(): string {
    return [
      'You are a helpful assistant. Answer the user\'s questions clearly and concisely.',
      'Use Markdown formatting for your responses when appropriate (code blocks, lists, bold, etc.).'
    ].join('\n');
  }
}
