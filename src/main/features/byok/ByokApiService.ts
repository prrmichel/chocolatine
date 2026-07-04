/**
 * Direct API client for BYOK providers (DeepSeek, OpenAI-compatible).
 *
 * Bypasses the Copilot SDK entirely — makes raw HTTP calls to the
 * provider's /v1/chat/completions endpoint with SSE streaming support.
 */

export interface ByokProviderCredentials {
  type: string;
  baseUrl: string;
  apiKey: string;
}

export interface ByokChatRequest {
  provider: ByokProviderCredentials;
  model: string;
  prompt: string;
  onDelta?: (delta: string, fullText: string) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Call the provider's chat completions API and return the full response.
 * Supports SSE streaming via the onDelta callback.
 */
export class ByokApiService {
  async chat(request: ByokChatRequest): Promise<string> {
    const { provider, model, prompt, onDelta, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = request;
    const baseUrl = provider.baseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/v1/chat/completions`;

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const effectiveSignal = signal
      ? anySignal([signal, timeoutController.signal])
      : timeoutController.signal;

    try {
      const streaming = Boolean(onDelta);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
          Accept: streaming ? 'text/event-stream' : 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          stream: streaming,
          max_tokens: 4096
        }),
        signal: effectiveSignal
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          response.status === 401 || response.status === 403
            ? 'API key invalid — check your BYOK provider settings.'
            : `Provider API error (HTTP ${response.status}): ${errorText.slice(0, 200)}`
        );
      }

      if (!streaming || !response.body) {
        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        return data.choices?.[0]?.message?.content ?? '';
      }

      // SSE streaming
      return this.readStream(response.body, onDelta!);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async readStream(
    body: ReadableStream<Uint8Array>,
    onDelta: (delta: string, fullText: string) => void
  ): Promise<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              onDelta(content, fullText);
            }
          } catch {
            // Skip unparseable SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }
}

/** Combine multiple AbortSignals into one. */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const onAbort = (reason: unknown) => {
    controller.abort(reason);
    for (const signal of signals) {
      signal.removeEventListener('abort', onAbort);
    }
  };
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
}
