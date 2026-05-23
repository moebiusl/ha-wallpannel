type WsLike = {
  send(data: string): void;
  close(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
};

declare const WebSocket: {
  new (url: string): WsLike;
};

export type AreaRegistryEntry = {
  area_id: string;
  name: string;
  floor_id?: string | null;
};

export type FloorRegistryEntry = {
  floor_id: string;
  name: string;
  level?: number | null;
};

export type DeviceRegistryEntry = {
  id: string;
  name?: string | null;
  name_by_user?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  area_id?: string | null;
  disabled_by?: string | null;
};

export type EntityRegistryEntry = {
  entity_id: string;
  unique_id?: string;
  name?: string | null;
  original_name?: string | null;
  device_id?: string | null;
  area_id?: string | null;
  platform?: string;
  hidden_by?: string | null;
  disabled_by?: string | null;
  entity_category?: string | null;
};

export type HaRegistries = {
  floors: FloorRegistryEntry[];
  areas: AreaRegistryEntry[];
  devices: DeviceRegistryEntry[];
  entities: EntityRegistryEntry[];
};

function wsUrlFromHaUrl(haUrl: string): string {
  const parsed = new URL(haUrl);
  const basePath = parsed.pathname.replace(/\/$/, "");
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = `${basePath}/api/websocket`;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function describeWsError(error: unknown, wsUrl: string): Error {
  if (error instanceof Error) {
    return error;
  }

  if (error && typeof error === "object") {
    const event = error as { message?: string; type?: string };
    return new Error(`Home-Assistant-WebSocket konnte nicht verbunden werden (${wsUrl}${event.type ? `, ${event.type}` : ""}${event.message ? `: ${event.message}` : ""})`);
  }

  return new Error(`Home-Assistant-WebSocket konnte nicht verbunden werden (${wsUrl}): ${String(error)}`);
}

// ---------------------------------------------------------------------------
// Persistent state-change subscription
// ---------------------------------------------------------------------------

export type StateChangeEventContext = {
  userId: string | null;
  origin: string;
};

type StateChangeCallback = (
  entityId: string,
  newState: string,
  oldState: string | null,
  eventContext: StateChangeEventContext
) => void;

/**
 * Opens a persistent WebSocket connection to HA and calls `onStateChange`
 * whenever one of the given `entityIds` changes its state.
 * Automatically reconnects on disconnect.
 * Returns a cancel function that stops reconnecting and closes the socket.
 */
export function subscribeToStateChanges(
  haUrl: string,
  token: string,
  entityIds: ReadonlyArray<string>,
  onStateChange: StateChangeCallback
): () => void {
  let cancelled = false;
  let ws: WsLike | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = 5000;

  function scheduleReconnect(): void {
    if (cancelled) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectDelay);
    // Exponential backoff up to 60 s
    reconnectDelay = Math.min(reconnectDelay * 2, 60_000);
  }

  function connect(): void {
    if (cancelled) return;

    const wsUrl = wsUrlFromHaUrl(haUrl);
    const socket = new WebSocket(wsUrl);
    ws = socket;

    let subscriptionId: number | null = null;
    let nextId = 1;

    socket.onmessage = (event: { data: unknown }) => {
      try {
        const raw =
          typeof event.data === "string"
            ? event.data
            : Buffer.from(event.data as ArrayBuffer).toString();
        const msg = JSON.parse(raw);

        if (msg.type === "auth_required") {
          socket.send(JSON.stringify({ type: "auth", access_token: token }));
          return;
        }

        if (msg.type === "auth_ok") {
          reconnectDelay = 5000; // reset after successful connect
          const id = nextId++;
          subscriptionId = id;
          socket.send(
            JSON.stringify({ id, type: "subscribe_events", event_type: "state_changed" })
          );
          return;
        }

        if (msg.type === "auth_invalid") {
          console.error("[gate-watch] HA WebSocket-Auth fehlgeschlagen — kein Reconnect");
          cancelled = true; // Don't retry on auth failure
          try { socket.close(); } catch (_) { /* ignore */ }
          return;
        }

        if (msg.type === "event" && msg.id === subscriptionId) {
          const d = msg.event?.data;
          if (!d) return;
          const entityId = d.entity_id as string;
          if (!(entityIds as string[]).includes(entityId)) return;

          const newState = (d.new_state?.state ?? undefined) as string | undefined;
          const oldState = (d.old_state?.state ?? undefined) as string | undefined;

          if (newState === undefined) return;
          if (newState === oldState) return; // no real change

          const evtCtx = msg.event?.context;
          onStateChange(entityId, newState, oldState ?? null, {
            userId: (evtCtx?.user_id as string) ?? null,
            origin: (msg.event?.origin as string) ?? "LOCAL",
          });
        }
      } catch (_err) {
        // Ignore JSON parse errors etc.
      }
    };

    socket.onerror = (_err: unknown) => {
      try { socket.close(); } catch (_) { /* ignore */ }
    };

    socket.onclose = (_evt: unknown) => {
      ws = null;
      scheduleReconnect();
    };
  }

  connect();

  return () => {
    cancelled = true;
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      try { ws.close(); } catch (_) { /* ignore */ }
      ws = null;
    }
  };
}

// ---------------------------------------------------------------------------

export async function getHaRegistries(haUrl: string, token: string): Promise<HaRegistries> {
  const wsUrl = wsUrlFromHaUrl(haUrl);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

    const timeout = setTimeout(() => {
      try { ws.close(); } catch (_) { /* ignore */ }
      reject(new Error("Timeout beim Lesen der Home-Assistant-Registries"));
    }, 10000);

    function sendCommand(type: string): Promise<unknown> {
      const id = nextId++;
      const command = { id, type };
      return new Promise((commandResolve, commandReject) => {
        pending.set(id, { resolve: commandResolve, reject: commandReject });
        ws.send(JSON.stringify(command));
      });
    }

    ws.onmessage = async (event: { data: unknown }) => {
      try {
        const raw = typeof event.data === "string" ? event.data : Buffer.from(event.data as ArrayBuffer).toString();
        const msg = JSON.parse(raw);

        if (msg.type === "auth_required") {
          ws.send(JSON.stringify({ type: "auth", access_token: token }));
          return;
        }

        if (msg.type === "auth_invalid") {
          clearTimeout(timeout);
          reject(new Error("Home-Assistant-WebSocket-Auth fehlgeschlagen"));
          try { ws.close(); } catch (_) { /* ignore */ }
          return;
        }

        if (msg.type === "auth_ok") {
          const [areas, devices, entities, floors] = await Promise.all([
            sendCommand("config/area_registry/list"),
            sendCommand("config/device_registry/list"),
            sendCommand("config/entity_registry/list"),
            sendCommand("config/floor_registry/list").catch(() => [])
          ]);

          clearTimeout(timeout);
          try { ws.close(); } catch (_) { /* ignore */ }
          resolve({
            areas: Array.isArray(areas) ? areas as AreaRegistryEntry[] : [],
            devices: Array.isArray(devices) ? devices as DeviceRegistryEntry[] : [],
            entities: Array.isArray(entities) ? entities as EntityRegistryEntry[] : [],
            floors: Array.isArray(floors) ? floors as FloorRegistryEntry[] : []
          });
          return;
        }

        if (msg.type === "result" && typeof msg.id === "number") {
          const entry = pending.get(msg.id);
          if (!entry) {
            return;
          }
          pending.delete(msg.id);
          if (msg.success) {
            entry.resolve(msg.result);
          } else {
            entry.reject(new Error(msg.error?.message || "HA WebSocket command failed"));
          }
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    ws.onerror = (error: unknown) => {
      clearTimeout(timeout);
      reject(describeWsError(error, wsUrl));
    };
  });
}
