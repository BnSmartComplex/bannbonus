"use client";

import { useEffect, useRef, useState } from "react";
import { dayNeramitBusiness } from "@/lib/day-neramit-business";

export type MapPoint = { latitude: number; longitude: number };
export type RoadGeometry = { type: "LineString"; coordinates: [number, number][] };
type LngLat = { lng: number; lat: number };
type MapMarker = {
  setLngLat: (p: [number, number]) => MapMarker;
  addTo: (map: MapInstance) => MapMarker;
  remove: () => void;
};
type MapInstance = {
  on: (name: string, handler: (event: { lngLat: LngLat }) => void) => void;
  remove: () => void;
  addControl: (control: object, position?: string) => void;
  addSource: (id: string, source: object) => void;
  addLayer: (layer: object) => void;
  getSource: (id: string) => { setData: (data: object) => void } | undefined;
  getStyle: () => { layers?: Array<{id: string;type: string;layout?: Record<string,unknown>}> };
  setLayoutProperty: (layer: string, property: string, value: unknown) => void;
  fitBounds: (bounds: object, options: object) => void;
  flyTo: (options: object) => void;
};
type MapLib = {
  Map: new(opts:{container:HTMLElement;style:string;center:[number,number];zoom:number;attributionControl:boolean})=>MapInstance;
  Marker: new(opts:{color:string})=>MapMarker;
  NavigationControl: new(opts:{showCompass:boolean})=>object;
  LngLatBounds: new(a:[number,number],b:[number,number])=>{extend:(p:[number,number])=>object};
};
declare global { interface Window { maplibregl?: MapLib } }

const office = dayNeramitBusiness.officeCoordinates;
const coordinate = (p: MapPoint):[number,number] => [p.longitude,p.latitude];
const SOURCE = "chang24-office-route";
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const MAPLIBRE_VERSION = "5.12.0";
let loading: Promise<MapLib> | undefined;

function loadMapLibre(): Promise<MapLib> {
  if (typeof window === "undefined") return Promise.reject(new Error("CLIENT_ONLY"));
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (loading) return loading;
  loading = new Promise<MapLib>((resolve,reject)=>{
    const cssId="chang24-maplibre-css";
    if (!document.getElementById(cssId)) {
      const css=document.createElement("link");
      css.id=cssId;css.rel="stylesheet";
      css.href=`https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
      document.head.appendChild(css);
    }
    const js=document.createElement("script");
    js.async=true;
    js.src=`https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
    js.onload=()=>window.maplibregl?resolve(window.maplibregl):reject(new Error("MAP_MODULE_MISSING"));
    js.onerror=()=>reject(new Error("MAP_LIBRARY_UNAVAILABLE"));
    document.head.appendChild(js);
  }).catch(error=>{loading=undefined;throw error;});
  return loading;
}

function routeCollection(geometry: RoadGeometry) {
  return {type:"FeatureCollection",features:[{type:"Feature",properties:{},geometry}]};
}

/** MapLibre vector labels prefer OSM's Thai name, then the mapped local name. */
function localizeThai(map:MapInstance) {
  for (const layer of map.getStyle().layers??[]) {
    if (layer.type!=="symbol" || layer.layout?.["text-field"]===undefined) continue;
    try {
      map.setLayoutProperty(layer.id,"text-field",[
        "coalesce",["get","name:th"],["get","name_th"],["get","name"],
        ["get","name_en"],
      ]);
    } catch { /* Skip labels that do not support a locale override. */ }
  }
}

export function CustomerRoadMap({
  point,route,onPick,subdistrict,moo,soi,
}:{
  point:MapPoint|null;
  route:RoadGeometry|null;
  onPick:(point:MapPoint)=>void;
  subdistrict:string;
  moo:string;
  soi:string;
}) {
  const node=useRef<HTMLDivElement>(null);
  const map=useRef<MapInstance|null>(null);
  const marker=useRef<MapMarker|null>(null);
  const picked=useRef(onPick);
  const ready=useRef(false);
  const [error,setError]=useState("");
  picked.current=onPick;

  useEffect(()=>{
    let alive=true;
    let instance:MapInstance|null=null;
    void loadMapLibre().then(lib=>{
      if(!alive||!node.current)return;
      instance=new lib.Map({
        container:node.current,
        style:STYLE_URL,
        center:coordinate(office),
        zoom:15.3,
        attributionControl:true,
      });
      map.current=instance;
      instance.addControl(new lib.NavigationControl({showCompass:true}),"top-right");
      new lib.Marker({color:"#e7bb5e"}).setLngLat(coordinate(office)).addTo(instance);
      instance.on("click",(event)=>{
        const latitude=event.lngLat.lat;
        const longitude=event.lngLat.lng;
        if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<5||latitude>21||longitude<97||longitude>106){
          setError("กรุณาเลือกตำแหน่งภายในประเทศไทย");
          return;
        }
        picked.current({latitude,longitude});
        setError("");
      });
      instance.on("load",()=>{
        ready.current=true;
        localizeThai(instance!);
        instance!.addSource(SOURCE,{type:"geojson",data:{type:"FeatureCollection",features:[]}});
        instance!.addLayer({id:SOURCE,type:"line",source:SOURCE,layout:{"line-join":"round","line-cap":"round"},
          paint:{"line-color":"#e7bb5e","line-width":5,"line-opacity":0.96}});
      });
      instance.on("error",()=>setError("แผนที่โหลดข้อมูลบางส่วนไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ"));
    }).catch(()=>{if(alive)setError("โหลดแผนที่ไม่ได้ กรุณากรอกที่อยู่และให้ทีมงานตรวจสอบ");});
    return ()=>{alive=false;ready.current=false;marker.current?.remove();marker.current=null;instance?.remove();if(map.current===instance)map.current=null;};
  },[]);

  useEffect(()=>{
    if(!map.current)return;
    marker.current?.remove();
    marker.current=null;
    if(!point)return;
    if(!window.maplibregl)return;
    marker.current=new window.maplibregl.Marker({color:"#39b6ff"}).setLngLat(coordinate(point)).addTo(map.current);
    if(!route)map.current.flyTo({center:coordinate(point),zoom:17});
  },[point,route]);

  useEffect(()=>{
    const current=map.current;
    if(!current||!ready.current)return;
    const data=route?routeCollection(route):{type:"FeatureCollection",features:[]};
    current.getSource(SOURCE)?.setData(data);
    if(point&&route&&window.maplibregl){
      const bounds=new window.maplibregl.LngLatBounds(coordinate(office),coordinate(point));
      for(const p of route.coordinates)bounds.extend(p);
      current.fitBounds(bounds,{padding:48,maxZoom:17,duration:600});
    }
  },[route,point]);

  return <div className="card" style={{margin:"16px 0",padding:16}}>
    <h3 style={{marginTop:0}}>แผนที่สำนักงานไปยังบ้านลูกค้า</h3>
    <p className="muted">แผนที่ OpenStreetMap แสดงชื่อถนน ซอย และสถานที่เป็นภาษาไทยเมื่อมีข้อมูล กดที่แผนที่เพื่อปักหมุดบ้านลูกค้าให้ตรงกับทางเข้ารถจริง</p>
    <div ref={node} lang="th" role="application" aria-label="แผนที่เลือกที่อยู่ลูกค้า แสดงถนนและซอย" style={{height:385,width:"100%",borderRadius:12,overflow:"hidden",background:"#ddd"}}/>
    {error&&<p role="status" className="notice">{error}</p>}
    <p className="muted">หมุดสีทอง = สำนักงานช่างเดย์เนรมิตร · หมุดสีน้ำเงิน = บ้านลูกค้า · เส้นสีทอง = เส้นทางขับรถที่คำนวณได้</p>
    {point ? <div className="notice" aria-live="polite">
      <strong>พิกัดบ้านลูกค้าที่เลือก</strong> {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
      <p>ตำบล: {subdistrict.trim()||"รอลูกค้ายืนยัน"} · หมู่ที่: {moo.trim()||"ไม่ระบุ / ไม่มีข้อมูล"} · ซอย: {soi.trim()||"รอลูกค้ายืนยัน"}</p>
    </div> : <p className="notice">กรุณาปักหมุดตำแหน่งบ้านบนแผนที่ หรือกดใช้ตำแหน่งจากมือถือเมื่ออยู่หน้าบ้าน</p>}
    <small>ข้อมูลแผนที่ © OpenStreetMap contributors · การแสดงชื่อซอย/ตำบลขึ้นอยู่กับข้อมูลที่มีอยู่ใน OSM หมู่ที่ต้องยืนยันกับลูกค้า ไม่ประมาณจากพิกัด</small>
  </div>;
}
