const WS_URL = import.meta.env.VITE_WS_URL as string | undefined;

class GameWebSocket {
  private socket: WebSocket | null = null;
  private listeners: Array<(data: any) => void> = [];
  private queue: any[] = [];
  private reconnectDelay = 3000;

  constructor() {
    if (!WS_URL) {
      console.error("Missing VITE_WS_URL env var for WebSocket");
      return;
    }
    this.connect();
  }

  private bindSocketHandlers() {
    if (!this.socket) return;

    this.socket.onopen = () => {
      console.log("WebSocket connected");
      // Flush queued outbound messages.
      while (this.queue.length && this.socket?.readyState === WebSocket.OPEN) {
        const payload = this.queue.shift();
        this.socket.send(JSON.stringify(payload));
      }
    };

    this.socket.onclose = () => {
      console.log("WebSocket disconnected, retrying in 3s...");
      setTimeout(() => this.connect(), this.reconnectDelay);
    };

    this.socket.onerror = (err) => console.error("WebSocket error:", err);

    this.socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        this.listeners.forEach((cb) => cb(parsed));
      } catch (_err) {
        console.warn("Failed to parse WebSocket message:", event.data);
      }
    };
  }

  private connect() {
    if (!WS_URL) return;
    this.socket = new WebSocket(WS_URL);
    this.bindSocketHandlers();
  }

  send(data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      this.queue.push(data);
    }
  }

  onMessage(callback: (data: any) => void) {
    this.listeners.push(callback);
  }

  close() {
    this.socket?.close();
  }
}

export const gameWS = new GameWebSocket();