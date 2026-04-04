type Handler = () => void;

let onSessionInvalid: Handler | null = null;

export function setSessionInvalidHandler(handler: Handler | null): void {
  onSessionInvalid = handler;
}

export function emitSessionInvalid(): void {
  onSessionInvalid?.();
}
