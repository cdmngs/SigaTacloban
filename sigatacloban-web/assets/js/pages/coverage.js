import { getCoverage, planCoverageStation } from "../api/coverage.js";
import { fetchRiskAreas } from "../api/risk.js";
import { fetchIncidents } from "../api/incidents.js";
import { createMap } from "../maps/map-view.js";
import { addMapLayers } from "../maps/layers.js";
import { createMapModeControl } from "../ui/map-mode-control.js";
import { openOverlay } from "../ui/overlays.js";
import { escapeHtml } from "../utils/dom.js";
import { iconSvg } from "../ui/icons.js";
import { createEmptyState } from "../ui/empty-state.js";

const styles = ["phase4-pages.css", "coverage.css"];
const esc = escapeHtml;
const riskColors = { low: "#2E9E5B", moderate: "#F4C430", high: "#F77F00" };

function ensureStyles() {
  for (const file of styles) {
    const id = `phase4-${file}`;
    if (document.getElementById(id)) continue;
    const link = document.createElement("link"); link.id=id; link.rel="stylesheet"; link.href=`assets/css/${file}`; document.head.append(link);
  }
}

export async function mount(main, user) {
  ensureStyles();
  main.innerHTML='<div class="phase4-page phase4-loading"><div class="skeleton phase4-title-skeleton"></div><div class="coverage-skeleton"><div class="skeleton"></div><div class="skeleton"></div></div></div>';
  const retry = () => mount(main,user);
  try {
    const [coverage,areas,incidents]=await Promise.all([getCoverage(),fetchRiskAreas(),fetchIncidents()]);
    const canPlan=user?.role==="admin"||user?.role==="prevention";
    let mode="risk";let selectedAreaId=null;let rings=[5,10,15];let plan=null;
    main.innerHTML=`<div class="phase4-page coverage-page"><header class="phase4-heading"><div><span class="eyebrow">OPERATIONAL READINESS</span><h1>Station coverage</h1><p>Response-time coverage and underserved risk areas.</p></div></header>
      <section class="card coverage-toolbar" aria-label="Coverage map controls"><div class="coverage-search-wrap"><label class="coverage-search">${iconSvg("search",16)}<span class="sr-only">Search barangay or address</span><input aria-label="Search barangay or address" placeholder="Search barangay or address..." autocomplete="off"><button type="button" aria-label="Locate matching barangay">${iconSvg("pin",16)}</button></label><div class="coverage-search-results" role="listbox" aria-label="Search suggestions" hidden></div></div><div class="coverage-mode-slot"></div><span class="coverage-toolbar-divider" aria-hidden="true"></span>
        <div class="coverage-rings-legend"><b>Response coverage</b>${[5,10,15].map((minute)=>`<label class="checkbox-label"><input type="checkbox" value="${minute}" checked><i style="background:${riskColors[{5:"low",10:"moderate",15:"high"}[minute]]}"></i>${minute} min</label>`).join("")}</div></section>
      <div class="incidents-layout coverage-layout"><section class="card incident-map-card coverage-map-card"><div class="coverage-map-view incident-side-map"></div></section>
        <aside class="coverage-side-column"><section class="card coverage-score-card"><span class="eyebrow">CITY COVERAGE SCORE</span><div class="coverage-score"><strong class="score-value">${plan?.afterScore??coverage.score}</strong><span>/100</span></div><div class="coverage-progress"><i style="width:${coverage.score}%"></i></div><small class="coverage-trend">${coverage.changePercent}% better than last quarter</small><small class="coverage-before-after" hidden></small></section>
          <section class="card underserved-card"><span class="eyebrow">REQUIRES PLANNING ATTENTION</span><h2>Underserved high-risk areas</h2><div class="underserved-list">${coverage.underserved.length?coverage.underserved.map(({area,estimatedResponseMinutes})=>`<button data-area="${esc(area.id)}" class="${selectedAreaId===area.id?"active":""}"><span class="underserved-top"><b>${esc(area.name)}</b><strong>${estimatedResponseMinutes} min</strong></span><span class="risk-chip risk-${esc(area.level)}">${esc(area.level)}</span><div class="response-track"><i style="width:${Math.min(100,estimatedResponseMinutes/16*100)}%"></i></div><small>Estimated response</small></button>`).join(""):'<div class="coverage-empty-state"></div>'}</div>${canPlan?'<button class="button button-secondary plan-station-button">'+iconSvg("plus",14)+'Plan new station</button>':""}</section></aside></div></div>`;
        if (!coverage.underserved.length) {
          main.querySelector(".coverage-empty-state").replaceWith(createEmptyState("No underserved areas", "There are no underserved high-risk areas to display.", "map"));
        }
    const mapHost=main.querySelector(".coverage-map-view");
    const created=await createMap(mapHost,{interactive:true,zoom:12.1});const map=created.map;created.L.control.zoom({position:"bottomright"}).addTo(map);
    const layerSet=await addMapLayers(map,{areas,incidents,stations:coverage.stations,hotspots:[],visibility:{riskZones:true,incidents:true,hotspots:false,fireStations:true},selectedAreaId,coverageRingMinutes:rings,onSelectArea:(id)=>{selectedAreaId=id;selectList();}});
    const control=createMapModeControl({value:mode,label:"Map visualization",className:"coverage-mode",onChange:(value)=>{mode=value;layerSet?.setMode?.(mode);}});
    main.querySelector(".coverage-mode-slot").append(control.element);
    const selectList=()=>main.querySelectorAll("[data-area]").forEach((button)=>button.classList.toggle("active",button.dataset.area===selectedAreaId));
    const searchInput=main.querySelector(".coverage-search input");
    const suggestions=main.querySelector(".coverage-search-results");
    const locate=(value)=>{const area=areas.find((item)=>item.name.toLowerCase().includes(value.trim().toLowerCase()));if(area){selectedAreaId=area.id;map.setView(area.center,14);searchInput.value=area.name;selectList();suggestions.hidden=true;return true;}return false;};
    searchInput.addEventListener("input",()=>{const term=searchInput.value.trim().toLowerCase();const matches=term?areas.filter(area=>area.name.toLowerCase().includes(term)).slice(0,6):[];suggestions.replaceChildren(...matches.map(area=>{const button=document.createElement("button");button.type="button";button.role="option";button.textContent=area.name;button.addEventListener("click",()=>locate(area.name));return button;}));suggestions.hidden=!matches.length;});
    searchInput.addEventListener("keydown",(event)=>{if(event.key==="Enter"){event.preventDefault();if(!locate(searchInput.value))suggestions.hidden=true;}if(event.key==="Escape")suggestions.hidden=true;});
    main.querySelector(".coverage-search button").addEventListener("click",()=>locate(searchInput.value));
    main.querySelectorAll(".coverage-rings-legend input").forEach((input)=>input.addEventListener("change",()=>{const value=input.value;main.querySelectorAll(`.coverage-rings-legend input[value="${value}"]`).forEach((copy)=>{copy.checked=input.checked;});rings=[...main.querySelectorAll(".coverage-rings-legend input:checked")].map((item)=>Number(item.value));layerSet?.setCoverageRings(rings);}));
    main.querySelectorAll("[data-area]").forEach((button)=>button.addEventListener("click",()=>{selectedAreaId=button.dataset.area;const area=areas.find((item)=>item.id===selectedAreaId);if(area)map.setView(area.center,14);selectList();}));
    if(canPlan)main.querySelector(".plan-station-button").addEventListener("click",()=>{plan=null;main.querySelector(".score-value").textContent=String(coverage.score);main.querySelector(".coverage-progress i").style.width=`${coverage.score}%`;main.querySelector(".coverage-trend").textContent=`${coverage.changePercent}% better than last quarter`;main.querySelector(".coverage-before-after").hidden=true;void openPlanModal({areas,coverage,selectedAreaId,onEstimate:async(point)=>{plan=await planCoverageStation(point[0],point[1]);main.querySelector(".score-value").textContent=String(plan.afterScore);main.querySelector(".coverage-progress i").style.width=`${plan.afterScore}%`;const delta=main.querySelector(".coverage-trend");delta.textContent=`+${plan.afterScore-plan.beforeScore} points with planned station`;const before=main.querySelector(".coverage-before-after");before.hidden=false;before.textContent=`Before ${plan.beforeScore} · After ${plan.afterScore}`;main.dispatchEvent(new CustomEvent("app:toast",{bubbles:true,detail:{message:"Hypothetical station coverage estimated.",type:"success"}}));return plan;}});});
  } catch(error) {
    main.innerHTML='<div class="phase4-page"><div class="query-error" role="alert"><b>Station coverage data could not be loaded.</b><button class="button button-primary">Retry</button></div></div>';
    main.querySelector("button").addEventListener("click",retry);
  }
}

async function openPlanModal({areas,coverage,selectedAreaId,onEstimate}) {
  const content=document.createElement("div");
  content.className="coverage-plan-content";
  content.innerHTML=`<p class="plan-instruction">${iconSvg("info",16)}<span>Click the map to place a hypothetical fire station. Coverage impact is estimated from straight-line distances.</span></p><div class="plan-map"><div class="plan-pick-map"></div></div><div class="plan-location"><span class="plan-location-coordinate">${iconSvg("pin",14)}No location selected</span></div><section class="coverage-estimate-results" hidden><div class="coverage-estimate-stats"><article><span>Current coverage</span><strong class="coverage-before-score">—</strong><small>/100</small><i><b></b></i></article><article><span>With new station</span><strong class="coverage-after-score">—</strong><small>/100</small><i><b></b></i></article></div><span class="coverage-delta"></span><p class="coverage-no-data-note" hidden>No risk data yet, coverage is estimated by area.</p></section><p class="plan-simulation-note">This is a simulation. No station is created.</p>`;
  const footer=document.createElement("footer");footer.className="modal-fixed-footer coverage-plan-actions";
  const cancel=document.createElement("button");cancel.type="button";cancel.className="button button-secondary overlay-cancel";cancel.textContent="Cancel";
  const button=document.createElement("button");button.type="button";button.className="button button-primary estimate-coverage";button.disabled=true;button.textContent="Estimate coverage";
  footer.append(cancel,button);
  let map=null;
  let destroyPickerMap=null;
  let pickerClosed=false;
  const close=openOverlay({title:"Plan new station",subtitle:"Estimate how a hypothetical station would change coverage.",content,footer,onClose:()=>{pickerClosed=true;destroyPickerMap?.();}});
  document.querySelector(".modal-panel")?.classList.add("coverage-plan-modal");
  let point=null;
  const coordinate=content.querySelector(".plan-location-coordinate");
  try {
    const created=await createMap(content.querySelector(".plan-pick-map"),{interactive:true,zoom:13});map=created.map;destroyPickerMap=created.destroy;if(pickerClosed){destroyPickerMap();return;}created.L.control.zoom({position:"bottomright"}).addTo(map);
    const layers=await addMapLayers(map,{areas,incidents:[],stations:coverage.stations,visibility:{riskZones:true,incidents:false,hotspots:false,fireStations:true},selectedAreaId});
    const pickerLayer=created.L.layerGroup().addTo(map);
    const setPoint=(coords)=>{point=coords;pickerLayer.clearLayers();const marker=created.L.marker(coords,{draggable:true}).addTo(pickerLayer);marker.on("dragend",()=>setPoint([marker.getLatLng().lat,marker.getLatLng().lng]));coordinate.innerHTML=`${iconSvg("pin",14)}Lat ${coords[0].toFixed(5)}, Lng ${coords[1].toFixed(5)}`;button.disabled=false;content.querySelector(".coverage-estimate-results").hidden=true;};
    map.on("click",(event)=>setPoint([event.latlng.lat,event.latlng.lng]));
    button.addEventListener("click",async()=>{if(!point)return;button.disabled=true;button.textContent="Estimating…";try{const result=await onEstimate(point);content.querySelector(".coverage-before-score").textContent=areas.length?String(result.beforeScore):"—";content.querySelector(".coverage-after-score").textContent=areas.length?String(result.afterScore):"—";content.querySelectorAll(".coverage-estimate-stats article").forEach((card,index)=>{const score=index?result.afterScore:result.beforeScore;card.querySelector("i b").style.width=`${areas.length?score:0}%`;});const delta=result.afterScore-result.beforeScore;const badge=content.querySelector(".coverage-delta");badge.textContent=areas.length?`${delta>0?"+":""}${delta} points`:"— points";badge.className=`coverage-delta${delta>0?" is-positive":""}`;content.querySelector(".coverage-no-data-note").hidden=areas.length>0;content.querySelector(".coverage-estimate-results").hidden=false;button.disabled=false;button.textContent="Estimate coverage";}catch(error){button.disabled=false;button.textContent="Estimate coverage";document.dispatchEvent(new CustomEvent("app:toast",{bubbles:true,detail:{message:error.message||"Coverage could not be estimated.",type:"error"}}));}});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,180))));
    map.invalidateSize({animate:false,pan:false});
    void layers;
  } catch(error) {
    coordinate.textContent="Map could not be loaded.";
    document.dispatchEvent(new CustomEvent("app:toast",{bubbles:true,detail:{message:error.message||"Station map could not be loaded.",type:"error"}}));
  }
}
