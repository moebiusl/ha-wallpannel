type WsLike = {
  send(data: string): void;
  close(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
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
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = "/api/websocket";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

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
      reject(error instanceof Error ? error : new Error(String(error)));
    };
  });
}
