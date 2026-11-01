import fs from "fs";
import path from "path";
import crypto from "crypto";
export type LightPreset={id:string;name:string;action:"color"|"color_temp";value:number[]|number};
export function validateLightColor(data:Record<string,any>,a:Record<string,any>) {
  const modes=a.supported_color_modes || [];
  if((data.rgb_color || data.hs_color) && !modes.some((m:string)=>["rgb","rgbw","rgbww","hs","xy"].includes(m))) { throw new Error("Diese Lampe unterstützt keine Farben."); }
  if(data.color_temp_kelvin!==undefined && (!modes.includes("color_temp") || data.color_temp_kelvin<(a.min_color_temp_kelvin || (a.max_mireds?Math.round(1000000/a.max_mireds):2000)) || data.color_temp_kelvin>(a.max_color_temp_kelvin || (a.min_mireds?Math.round(1000000/a.min_mireds):6500)))) { throw new Error("Weißtemperatur für diese Lampe nicht unterstützt."); }
}
export function defaultLightPresets(a:Record<string,any>):LightPreset[] {
  const modes=a.supported_color_modes || [],color=modes.some((m:string)=>["rgb","rgbw","rgbww","hs","xy"].includes(m)),white=modes.includes("color_temp");
  const out:LightPreset[]=[];
  if(white){out.push({id:"warm",name:"Warmweiß",action:"color_temp",value:Math.max(a.min_color_temp_kelvin || 2000,Math.min(a.max_color_temp_kelvin || 6500,2700))});}
  if(color){if(!white){out.push({id:"warm",name:"Warmweiß",action:"color",value:[255,167,87]});}out.push({id:"red",name:"Rot",action:"color",value:[255,0,0]},{id:"green",name:"Grün",action:"color",value:[0,255,0]},{id:"blue",name:"Blau",action:"color",value:[0,80,255]},{id:"white",name:"Weiß",action:"color",value:[255,255,255]});}
  return out;
}
export function createLightPresets(file:string){
  let entries:Record<string,LightPreset[]>={};
  try{entries=JSON.parse(fs.readFileSync(file,"utf8"));}catch(e:any){if(e.code!=="ENOENT"){throw e;}}
  function list(id:string,a:Record<string,any>){return (entries[id] || defaultLightPresets(a)).filter(p=>{try{validateLightColor(p.action==="color"?{rgb_color:p.value}:{color_temp_kelvin:p.value},a);return true;}catch{return false;}});}
  function change(id:string,input:any,a:Record<string,any>){
    if(!/^light\.[a-z0-9_]+$/.test(id)){throw new Error("Ungültige Lampe.");}
    const next=list(id,a).slice();
    if(input.type==="remove"){
      const index=next.findIndex(p=>p.id===input.presetId);if(index<0){throw new Error("Vorauswahl nicht gefunden.");}next.splice(index,1);
    }else if(input.type==="save"){
      if(next.length>=12){throw new Error("Maximal zwölf Vorauswahlen pro Lampe.");}
      const p=input.preset;
      if(!p || !["color","color_temp"].includes(p.action)){throw new Error("Ungültige Vorauswahl.");}
      if(p.action==="color" && (!Array.isArray(p.value) || p.value.length!==3 || !p.value.every((v:any)=>typeof v==="number"&&Number.isInteger(v)&&v>=0&&v<=255))){throw new Error("Ungültige Farbe.");}
      if(p.action==="color_temp" && (typeof p.value!=="number" || !Number.isInteger(p.value) || p.value<1000 || p.value>12000)){throw new Error("Ungültige Weißtemperatur.");}
      validateLightColor(p.action==="color"?{rgb_color:p.value}:{color_temp_kelvin:p.value},a);
      next.push({id:crypto.randomBytes(8).toString("hex"),name:String(p.name || (p.action==="color_temp"?`Weiß ${p.value} K`:"Farbe")).trim().slice(0,40),action:p.action,value:p.value});
    }else{throw new Error("Ungültige Aktion.");}
    const updated={...entries,[id]:next};fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+".tmp",JSON.stringify(updated),{mode:0o600});fs.renameSync(file+".tmp",file);entries=updated;return next;
  }
  return {list,change};
}
