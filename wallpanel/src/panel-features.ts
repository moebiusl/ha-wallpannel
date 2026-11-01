import fs from "fs";
import path from "path";
import crypto from "crypto";

type Entity = Record<string, any>;
const available = (e: Entity) => !["unknown", "unavailable", ""].includes(String(e.state));
const numeric = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export function roomReadings(entities: Entity[]) {
  const rooms: Record<string, { temperature?: number; humidity?: number }> = {};
  for (const area of new Set(entities.filter(e => !e.haHidden && e.areaId).map(e => e.areaId))) {
    const values: Record<string, number[]> = { temperature: [], humidity: [] };
    for (const e of entities.filter(e => e.areaId === area && !e.haHidden && available(e))) {
      const dc = e.deviceClass || e.attributes?.device_class;
      if (e.domain !== "sensor" || !["temperature", "humidity"].includes(dc) || !String(e.state).trim()) { continue; }
      let value = Number(e.state);
      if (!Number.isFinite(value)) { continue; }
      if (dc === "temperature") {
        const unit = e.attributes?.unit_of_measurement;
        if (unit === "°F") { value = (value - 32) * 5 / 9; }
        else if (unit !== "°C") { continue; }
        if (value < -40 || value > 60) { continue; }
      } else if (e.attributes?.unit_of_measurement !== "%" || value < 0 || value > 100) { continue; }
      values[dc].push(value);
    }
    const reading: { temperature?: number; humidity?: number } = {};
    const fallback: Record<string, number[]> = {temperature:[],humidity:[]};
    // Prefer dedicated room sensors; thermostats can provide actual readings too.
    for (const e of entities.filter(e => e.areaId === area && e.domain === "climate" && !e.haHidden && available(e))) {
      const a=e.attributes || {};
      if(!values.temperature.length && numeric(a.current_temperature)) {
        let value=a.current_temperature;
        if(a.temperature_unit === "°F") { value=(value-32)*5/9; }
        if(value>=-40 && value<=60) { fallback.temperature.push(value); }
      }
      if(!values.humidity.length && numeric(a.current_humidity) && a.current_humidity>=0 && a.current_humidity<=100) { fallback.humidity.push(a.current_humidity); }
    }
    for (const key of ["temperature", "humidity"] as const) {
      if(!values[key].length) { values[key]=fallback[key]; }
      if (values[key].length) { reading[key] = Math.round(values[key].reduce((a,b) => a+b,0)/values[key].length*10)/10; }
    }
    if (Object.keys(reading).length) { rooms[area] = reading; }
  }
  return rooms;
}

/** Plan every target before writing anything. Off never changes saved temperatures. */
export function planClimateSync(entities: Entity[], sourceId: string) {
  const source = entities.find(e => e.entityId === sourceId && e.domain === "climate" && !e.haHidden && e.visibleByDefault);
  if (!source || !source.areaId || !available(source)) { throw new Error("Quellheizung nicht erreichbar oder keinem sichtbaren Raum zugeordnet."); }
  if (!source.attributes?.hvac_modes?.includes(source.state)) { throw new Error("Betriebsart der Quelle nicht unterstützt."); }
  const skipped: string[] = [];
  const targets = entities.filter(e => e.domain === "climate" && e.areaId === source.areaId && e.entityId !== sourceId && !e.haHidden && e.visibleByDefault);
  const plans = targets.flatMap(target => {
    if (!available(target)) { skipped.push(target.name); return []; }
    const a = target.attributes || {};
    if (!a.hvac_modes?.includes(source.state)) { throw new Error(`${target.name}: Betriebsart wird nicht unterstützt.`); }
    const temperature = source.state === "off" ? undefined : source.attributes.temperature;
    if (source.state !== "off") {
      const min = a.min_temp ?? 5, max = a.max_temp ?? 35, step = a.target_temp_step ?? .5;
      if (!numeric(temperature) || !numeric(min) || !numeric(max) || !numeric(step) || step <= 0 || temperature < min || temperature > max || Math.abs((temperature-min)/step-Math.round((temperature-min)/step)) > .001) {
        throw new Error(`${target.name}: Solltemperatur passt nicht zum Bereich oder zur Schrittweite.`);
      }
    }
    return [{ id: target.entityId as string, mode: source.state as string, temperature: temperature as number | undefined }];
  });
  return { plans, skipped };
}

export type InboxItem = { id: string; kind: string; title: string; message: string; active: boolean; hidden: boolean; done: boolean; firstAt: number; updatedAt: number; resolvedAt?: number };
type Reload = { id: string; createdAt: number; expiresAt: number };
type Data = { inbox: Record<string, InboxItem>; offline: Record<string, number>; reloads: Record<string, Reload> };
export function createPanelFeatures(file: string, clock: () => number = Date.now) {
  let data: Data = { inbox: {}, offline: {}, reloads: {} };
  try { const saved = JSON.parse(fs.readFileSync(file,"utf8")); data = { ...data, ...saved }; }
  catch (e: any) { if (e.code !== "ENOENT") { throw e; } }
  // Offline time requires continuous successful observation, never server downtime.
  data.offline = {};
  let lastObservation: number | undefined;
  const statuses = new Map<string, { version: string; sound: string; updatedAt: number }>();
  const persist = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file+".tmp",JSON.stringify(data), { mode:0o600 }); fs.renameSync(file+".tmp",file);
  };
  function mutate(fn: () => void) {
    const old = JSON.stringify(data);
    fn();
    if (old !== JSON.stringify(data)) { try { persist(); } catch(e) { data=JSON.parse(old); throw e; } }
  }
  function observe(entities: Entity[]) {
    const now=clock(), problems=new Map<string, { kind:string; title:string; message:string }>(), uncertain=new Set<string>();
    const visible=entities.filter(e => !e.haHidden && e.entityCategory !== "config");
    const groups=new Map<string, Entity[]>();
    for(const e of visible) { const key=e.deviceId || e.entityId; groups.set(key,[...(groups.get(key)||[]),e]); }
    mutate(() => {
      if(lastObservation !== undefined && now-lastObservation>60000) { data.offline={}; }
      for(const [key, group] of groups) {
        const label=group[0].deviceId && group[0].deviceName !== "Ohne Gerät" ? group[0].deviceName : group[0].name;
        const batteries=group.filter(e => (e.deviceClass || e.attributes?.device_class) === "battery");
        const measured=batteries.filter(e => e.domain === "sensor" && available(e) && String(e.state).trim() && Number.isFinite(Number(e.state)) && Number(e.state)>=0 && Number(e.state)<=100);
        const binary=batteries.filter(e => e.domain === "binary_sensor" && ["on","off"].includes(e.state));
        const low=measured.filter(e => Number(e.state)<=20);
        if(low.length || binary.some(e => e.state === "on")) { problems.set("battery:"+key,{kind:"battery",title:label,message:low.length ? `Batterie ${Math.min(...low.map(e=>Number(e.state)))} %` : "Batterie schwach"}); }
        else if(batteries.length && !measured.length && !binary.length) { uncertain.add("battery:"+key); }
        const primary=group.filter(e => e.visibleByDefault && !e.entityCategory && ["light","switch","climate","fan","cover","lock","sensor","binary_sensor","media_player"].includes(e.domain) && e.platform !== "icloud" && !e.entityId.startsWith("sensor.wallpanel_") && !/battery/.test(e.deviceClass || ""));
        if(primary.length && primary.every(e => !available(e))) {
          if(data.offline[key] === undefined) { data.offline[key]=now; }
          if(now-data.offline[key]>=600000) { problems.set("offline:"+key,{kind:"offline",title:label,message:"Seit mindestens 10 Minuten nicht erreichbar"}); }
          else { uncertain.add("offline:"+key); }
        } else { delete data.offline[key]; }
        for(const e of group) { if(e.domain === "binary_sensor" && ["door","window","opening","smoke","gas","moisture","safety"].includes(e.deviceClass)) {
          const id="state:"+e.entityId;
          if(e.state === "on") { problems.set(id,{kind:"state",title:e.name,message:["door","window","opening"].includes(e.deviceClass)?"Offen":"Alarm"}); }
          else if(!available(e)) { uncertain.add(id); }
        } }
      }
      for(const [id,p] of problems) {
        const item=data.inbox[id];
        if(!item || !item.active) { data.inbox[id]={id,...p,active:true,hidden:false,done:false,firstAt:now,updatedAt:now}; }
        else if(item.message !== p.message || item.title !== p.title) { Object.assign(item,p,{updatedAt:now}); }
      }
      for(const item of Object.values(data.inbox)) {
        if(item.active && !problems.has(item.id) && !uncertain.has(item.id)) { item.active=false;item.done=true;item.resolvedAt=now;item.updatedAt=now; }
        if(!item.active && now-(item.resolvedAt || item.updatedAt)>90*86400000) { delete data.inbox[item.id]; }
      }
      for(const key of Object.keys(data.offline)) { if(!groups.has(key)) { delete data.offline[key]; } }
      const items=Object.values(data.inbox).sort((a,b)=>b.updatedAt-a.updatedAt);
      for(const item of items.slice(500)) { if(!item.active) { delete data.inbox[item.id]; } }
    });
    lastObservation=now;
  }
  function action(id: string, action: string) {
    const item=data.inbox[id]; if(!item || !["hide","done","show"].includes(action)) { throw new Error("Hinweis oder Aktion unbekannt."); }
    mutate(()=>{if(action==="hide"){item.hidden=true;}else if(action==="done"){item.done=true;}else if(item.active){item.done=false;item.hidden=false;}item.updatedAt=clock();});
  }
  function requestReload(ids: string[]) {
    mutate(()=>{for(const id of ids) { data.reloads[id]={id:crypto.randomBytes(12).toString("hex"),createdAt:clock(),expiresAt:clock()+86400000}; }});
    return ids.length;
  }
  function sync(id: string, info: { ack?: unknown; version?: unknown; sound?: unknown }) {
    mutate(()=>{const job=data.reloads[id];if(job && (job.expiresAt<=clock() || job.id===info.ack)){delete data.reloads[id];}});
    statuses.set(id,{version:String(info.version || "").slice(0,24),sound:["ready","blocked","disabled"].includes(String(info.sound))?String(info.sound):"blocked",updatedAt:clock()});
    return data.reloads[id] || null;
  }
  return { observe, action, requestReload, sync, list:()=>Object.values(data.inbox).sort((a,b)=>b.updatedAt-a.updatedAt), status:(id:string)=>({ ...statuses.get(id),reload:data.reloads[id] || null }) };
}
