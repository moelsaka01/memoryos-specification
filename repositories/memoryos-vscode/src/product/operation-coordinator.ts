import { MEMORYOS_VSCODE_ADAPTER_ERROR_CODES, MemoryOSAdapterError } from "../errors.js";
import type { ProductOperationKind, ProductOperationResult, ProductPublicationSink } from "./contracts.js";

interface ActiveOperation {
  readonly abortController: AbortController;
  readonly token: string;
  completion: Promise<unknown>;
}

function cancelled(): MemoryOSAdapterError {
  return new MemoryOSAdapterError(MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.CANCELLED, "The MemoryOS operation was cancelled.");
}

/** Product-level exclusion and stale-publication gate; the CLI adapter has an independent worker gate. */
export class ProductOperationCoordinator {
  readonly #publicationSink: ProductPublicationSink | undefined;
  #active: ActiveOperation | undefined;
  #disposed = false;
  #sequence = 0;

  constructor(publicationSink?: ProductPublicationSink) { this.#publicationSink = publicationSink; }

  async run<T extends ProductOperationResult>(
    kind: ProductOperationKind,
    externalSignal: AbortSignal | undefined,
    work: (signal: AbortSignal, token: string) => Promise<T>,
  ): Promise<T> {
    if (this.#disposed) {
      throw new MemoryOSAdapterError(MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.WORKER_FAILED, "The MemoryOS product controller is disposed.");
    }
    if (this.#active !== undefined) {
      throw new MemoryOSAdapterError(MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.OPERATION_IN_PROGRESS, "Only one MemoryOS semantic operation may execute at a time.");
    }
    const abortController = new AbortController();
    const token = `memoryos-operation-${String(++this.#sequence)}`;
    const active: ActiveOperation = { abortController, token, completion: Promise.resolve() };
    this.#active = active;
    const onAbort = (): void => abortController.abort();
    externalSignal?.addEventListener("abort", onAbort, { once: true });
    if (externalSignal?.aborted) abortController.abort();

    const completion = (async (): Promise<T> => {
      if (abortController.signal.aborted) throw cancelled();
      const result = await work(abortController.signal, token);
      if (abortController.signal.aborted || this.#disposed || this.#active !== active) throw cancelled();
      this.#publicationSink?.publish(Object.freeze({ operationKind: kind, operationToken: token, result }));
      if (abortController.signal.aborted || this.#disposed || this.#active !== active) throw cancelled();
      return result;
    })();
    active.completion = completion;
    try {
      return await completion;
    } finally {
      externalSignal?.removeEventListener("abort", onAbort);
      if (this.#active === active) this.#active = undefined;
    }
  }

  cancelActive(): void { this.#active?.abortController.abort(); }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    const active = this.#active;
    active?.abortController.abort();
    await active?.completion.catch(() => undefined);
    if (this.#active === active) this.#active = undefined;
  }
}
