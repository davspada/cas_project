import * as Notifications from 'expo-notifications';

type Message = Record<string, unknown>;

class WebSocketService {
  private socket: WebSocket | null = null;
  private messageListeners: Array<(data: unknown) => void> = [];

  connect(url: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.warn('WebSocket is already connected.');
      return;
    }

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log('WebSocket connected');
    };

    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      this.socket = null;
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);

        // Notify all listeners
        this.messageListeners.forEach((listener) => listener(data));

        // Optional: Show notification for specific messages
        if (data.type === 'notification') {
          this.showNotification(data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', event.data, error);
      }
    };
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
      console.log('WebSocket message sent:', message);
    } else {
      console.error('WebSocket is not connected.');
    }
  }

  onMessage(callback: (data: unknown) => void): void {
    this.messageListeners.push(callback);
  }

  private async showNotification(data: Message) {
    const title = data.title || 'New Notification';
    const body = data.body || 'You have received a new message.';
    
    await Notifications.scheduleNotificationAsync({
      content: { title: String(title), body: String(body) },
      trigger: null, // Display immediately
    });
  }
}

const websocketService = new WebSocketService();
export default websocketService;
