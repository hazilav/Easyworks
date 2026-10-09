import { recordRealtimeEvent } from '@/lib/db/database';

export interface RealtimeMessage {
  id: string;
  type: string;
  channel: string;
  payload: any;
  timestamp: string;
}

type ClientSubscriber = {
  id: string;
  channel: string;
  userId?: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  createdAt: number;
};

class EventBus {
  private subscribers: Map<string, ClientSubscriber> = new Map();
  private textEncoder = new TextEncoder();

  constructor() {
    // Keep-alive heartbeat interval (every 25 seconds)
    if (typeof setInterval !== 'undefined') {
      setInterval(() => {
        this.sendHeartbeat();
      }, 25000);
    }
  }

  /**
   * Register an SSE client connection
   */
  public subscribe(
    clientId: string,
    channel: string,
    controller: ReadableStreamDefaultController<Uint8Array>,
    userId?: string
  ): () => void {
    const subscriber: ClientSubscriber = {
      id: clientId,
      channel,
      userId,
      controller,
      createdAt: Date.now(),
    };

    this.subscribers.set(clientId, subscriber);

    // Return cleanup unsubscribe function
    return () => {
      this.subscribers.delete(clientId);
    };
  }

  /**
   * Unsubscribe a client
   */
  public unsubscribe(clientId: string): void {
    this.subscribers.delete(clientId);
  }

  /**
   * Get active connection metrics
   */
  public getMetrics(): {
    totalConnections: number;
    adminConnections: number;
    customerConnections: number;
  } {
    let admin = 0;
    let customer = 0;
    for (const sub of this.subscribers.values()) {
      if (sub.channel === 'admin') admin++;
      else if (sub.channel.startsWith('customer')) customer++;
    }
    return {
      totalConnections: this.subscribers.size,
      adminConnections: admin,
      customerConnections: customer,
    };
  }

  /**
   * Publish an event to a channel and persist in SQLite
   */
  public publish(channel: string, eventType: string, payload: any): RealtimeMessage {
    const timestamp = new Date().toISOString();
    let eventId = `evt_${Date.now()}`;

    try {
      eventId = recordRealtimeEvent(channel, eventType, payload);
    } catch (err) {
      console.warn('[EventBus] Could not persist event to DB:', err);
    }

    const message: RealtimeMessage = {
      id: eventId,
      type: eventType,
      channel,
      payload,
      timestamp,
    };

    const sseChunk = `id: ${message.id}\nevent: ${message.type}\ndata: ${JSON.stringify(message)}\n\n`;
    const encoded = this.textEncoder.encode(sseChunk);

    const deadClientIds: string[] = [];

    for (const [id, sub] of this.subscribers.entries()) {
      let matches = false;
      if (sub.channel === channel) {
        matches = true;
      }

      if (matches) {
        try {
          sub.controller.enqueue(encoded);
        } catch {
          deadClientIds.push(id);
        }
      }
    }

    for (const deadId of deadClientIds) {
      this.subscribers.delete(deadId);
    }

    return message;
  }

  /**
   * Send heartbeat comments across all active clients
   */
  private sendHeartbeat(): void {
    if (this.subscribers.size === 0) return;
    const heartbeatChunk = this.textEncoder.encode(`: keep-alive\n\n`);
    const deadClientIds: string[] = [];

    for (const [id, sub] of this.subscribers.entries()) {
      try {
        sub.controller.enqueue(heartbeatChunk);
      } catch {
        deadClientIds.push(id);
      }
    }

    for (const deadId of deadClientIds) {
      this.subscribers.delete(deadId);
    }
  }
}

// Global singleton to withstand Next.js HMR and route handler module isolation
const globalForEventBus = globalThis as unknown as {
  __easyworks_event_bus?: EventBus;
};

export const eventBus: EventBus = globalForEventBus.__easyworks_event_bus || new EventBus();

if (!globalForEventBus.__easyworks_event_bus) {
  globalForEventBus.__easyworks_event_bus = eventBus;
}

/**
 * Broadcast event to Developer/SuperAdmin panel
 */
export function broadcastAdminEvent(eventType: string, payload: any): RealtimeMessage {
  return eventBus.publish('admin', eventType, payload);
}

/**
 * Broadcast event to a specific Customer
 */
export function broadcastCustomerEvent(userId: string, eventType: string, payload: any): RealtimeMessage {
  return eventBus.publish(`customer:${userId}`, eventType, payload);
}
