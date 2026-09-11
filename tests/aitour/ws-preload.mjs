if (!globalThis.WebSocket) {
  class DummyWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    constructor() { this.readyState = DummyWebSocket.CLOSED; }
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  }
  globalThis.WebSocket = DummyWebSocket;
}
