import { describe,expect,it } from "vitest";
import { parseOpenRouteServiceGeoJson } from "./openstreetmap-route";

const response = {
  type:"FeatureCollection",
  features:[{type:"Feature",geometry:{type:"LineString",coordinates:[
    [100.4110222,13.8692121],[100.416,13.871],[100.419,13.873],
  ]},properties:{summary:{distance:6200,duration:760},segments:[{steps:[
    {name:"ซอยหมู่บ้านจิตตกาญจน์วิลล่า 2",type:11,distance:350},
    {name:"ถนนกาญจนาภิเษก",type:1,distance:4900},{name:"-",type:10,distance:0},
  ]}]}}]
};

describe("OpenStreetMap driving route data",()=>{
  it("parses metres, ETA, geometry and Thai street names without changing source names",()=>{
    const r=parseOpenRouteServiceGeoJson(response);
    expect(r?.distanceMeters).toBe(6200);
    expect(r?.durationSeconds).toBe(760);
    expect(r?.roadSteps[0].instructionTh).toContain("ซอยหมู่บ้านจิตตกาญจน์วิลล่า 2");
    expect(r?.roadSteps[1].instructionTh).toContain("เลี้ยวขวา");
    expect(r?.roadSteps[2].roadName).toBeNull();
  });
  it("refuses missing road geometry and does not fabricate straight-line distance",()=>{
    expect(parseOpenRouteServiceGeoJson({features:[]})).toBeNull();
    expect(parseOpenRouteServiceGeoJson({features:[{geometry:{type:"LineString",coordinates:[
      [100.411,13.869],[100.414,13.872]]},properties:{summary:{distance:null,duration:20}}}]})).toBeNull();
  });
  it("rejects route coordinates outside Thai bounds",()=>{
    const r=structuredClone(response);
    r.features[0].geometry.coordinates[1][0]=150;
    expect(parseOpenRouteServiceGeoJson(r)).toBeNull();
  });
});
