const WS_URL = process.env.NEXT_PUBLIC_WS_URL!; 

class GameWebSocket {
  private socket: WebSocket | null = null;

  constructor() {
    this.connect();
  }

  private connect() {
    this.socket = new WebSocket(WS_URL);

    this.socket.onopen = () => console.log("WebSocket connected");
    this.socket.onclose = () => {
      console.log("WebSocket disconnected, retrying in 3s...");
      setTimeout(() => this.connect(), 3000); // auto-reconnect
    };
    this.socket.onerror = (err) => console.error("WebSocket error:", err);
  }

  send(data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  onMessage(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        callback(parsed);
      } catch (err) {
        console.warn("Failed to parse WebSocket message:", event.data);
      }
    };
  }

  close() {
    this.socket?.close();
  }
}

export const gameWS = new GameWebSocket();