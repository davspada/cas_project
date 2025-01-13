import * as Notification  from "expo-notifications";

type Message = Record<string, unknown>;

class WebSocketService {
  private socket: WebSocket | null = null;

  connect(url: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => console.log('WebSocket connected');
      this.socket.onclose = () => console.log('WebSocket disconnected');
      this.socket.onerror = (error) => console.error('WebSocket error:', error);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  sendMessage(message: Message): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected.');
    }
  }

  onMessage(callback: (data: unknown) => void): void {
    if (this.socket) {
      this.socket.onmessage = (event) => callback(JSON.parse(event.data));
    }
  }
}

const websocketService = new WebSocketService();
export default websocketService;
