import { listIncidents, createIncident, updateIncident, deleteIncident, exportIncidents, fetchIncidentOptions } from "../api/incidents.js";
import { fetchRiskAreas } from "../api/risk.js";
import { createMap } from "../maps/map-view.js";
import { createLocationPicker } from "../maps/picker.js";
import { reverseGeocode } from "../api/nominatim.js";
import { loadData as loadPageData, renderFieldErrors } from "../core/data-state.js";
import { setSharedData } from "../core/store.js";
import { openOverlay } from "../ui/overlays.js";
import { downloadCsv } from "../utils/csv.js";
import { escapeHtml } from "../utils/dom.js";
import { iconSvg } from "../ui/icons.js";
import { BARANGAY_NAMES } from "../api/barangays.js";

const styles = ["phase4-pages.css", "incidents.css"];
let fireClasses = ["Residential", "Commercial", "Electrical", "Grass fire", "Industrial", "Vehicle"];
let severities = ["Low", "Moderate", "High", "Very High"];
const severityLevel = { Low: "low", Moderate: "moderate", High: "high", "Very High": "veryhigh" };
const emptyFilters = { search: "", barangay: "", from: "", to: "", fireClass: "", severity: "" };
const escape = escapeHtml;

function ensureStyles() {
  for (const file of styles) {
    const id = `phase4-${file}`;
    if (document.getElementById(id)) continue;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet"; link.href = `assets/css/${file}`; document.head.append(link);
  }
}

function currentFilters() {
  const params = new URLSearchParams(location.search);
  return {
    search: params.get("q") || "", barangay: params.get("barangay") || "",
    from: params.get("from") || "", to: params.get("to") || "",
    fireClass: params.get("class") || "", severity: params.get("severity") || "",
  };
}

function setFilters(patch, replace = true) {
  const next = new URLSearchParams(location.search);
  const filters = { ...currentFilters(), ...patch };
  const keys = { search: "q", barangay: "barangay", from: "from", to: "to", fireClass: "class", severity: "severity" };
  for (const [key, query] of Object.entries(keys)) filters[key] ? next.set(query, filters[key]) : next.delete(query);
  next.delete("page");
  history[replace ? "replaceState" : "pushState"](null, "", `${location.pathname}${next.size ? `?${next}` : ""}`);
}

function field(label, input) {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  wrapper.append(input);
  return wrapper;
}

function makeSelect(values, selected = "", placeholder = "Choose…") {
  const select = document.createElement("select");
  if (selected === "") {
    const blank = document.createElement("option");
    blank.value = ""; blank.textContent = placeholder; select.append(blank);
  }
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value; option.textContent = value; option.selected = value === selected; select.append(option);
  }
  return select;
}

export async function mount(main, user) {
  ensureStyles();
  const canManage = user?.role === "admin" || user?.role === "operations";
  main.innerHTML = `<div class="phase4-page phase4-loading"><div class="skeleton phase4-title-skeleton"></div><div class="skeleton incident-filter-skeleton"></div><div class="incident-loading-grid"><div class="skeleton"></div><div class="skeleton"></div></div></div>`;
  const loadData = async () => {
    try {
      const [areas, options] = await Promise.all([fetchRiskAreas(), fetchIncidentOptions()]);
      if (Array.isArray(options?.fireClasses)) fireClasses = options.fireClasses;
      if (Array.isArray(options?.severities)) severities = options.severities;
      const barangayNames = Array.isArray(options?.barangays) && options.barangays.length ? options.barangays : BARANGAY_NAMES;
      let page = Math.max(1, Number(new URLSearchParams(location.search).get("page")) || 1);
      let sort = { key: new URLSearchParams(location.search).get("sort") || "date", direction: new URLSearchParams(location.search).get("dir") === "asc" ? "asc" : "desc" };
      let allRows = [];
      let totalRows = 0;
      const pageSize = 10;
      let map;
      let markerLayer;
      let markers = new Map();
      let mapRows = [];
      let selected = null;
      let drawerClose;
      let incidentLoader;
      let searchTimer;
      const refresh = () => incidentLoader?.load([currentFilters(), page, pageSize, sort]);
      const renderPage = () => {
        main.innerHTML = `<div class="phase4-page incidents-page"><header class="phase4-heading"><div><span class="eyebrow">OPERATIONS ARCHIVE</span><h1>Historical incidents</h1><p>Investigate fire patterns across time and place.</p></div>${canManage ? '<button type="button" class="button button-primary add-incident">＋ Add incident</button>' : ""}</header>
          <section class="card incident-filter-card"><div class="incident-filter-grid"><label class="incident-search">${iconSvg("search",14)}<span class="sr-only">Search incidents</span><input data-filter="search" placeholder="Search incidents..."></label>
            <label><span class="sr-only">Filter by barangay</span><select data-filter="barangay"><option value="">All barangays</option></select></label>
            <label><span class="sr-only">Date range preset</span><select class="date-preset"><option value="custom">Date range</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="2024">Jan-Sep 2024</option></select></label>
            <label class="custom-date"><span class="sr-only">From date</span><input aria-label="From date" type="date" data-filter="from"></label><label class="custom-date"><span class="sr-only">To date</span><input aria-label="To date" type="date" data-filter="to"></label>
            <label><span class="sr-only">Filter by fire class</span><select data-filter="fireClass"><option value="">All fire classes</option>${fireClasses.map((item) => `<option>${item}</option>`).join("")}</select></label>
            <label><span class="sr-only">Filter by severity</span><select data-filter="severity"><option value="">All severity</option>${severities.map((item) => `<option>${item}</option>`).join("")}</select></label>
            <button type="button" class="button button-ghost button-sm reset-filters">${iconSvg("refresh",12)}Reset</button></div></section>
          <div class="incidents-layout"><section class="card incident-map-card"><div class="incident-side-map"></div></section>
            <section class="card incidents-table-card"><header><b class="incident-count">0 incidents</b><div class="incident-header-actions"><button type="button" class="button button-secondary button-sm clear-filters">Clear filters</button><button type="button" class="button button-secondary button-sm export-incidents">${iconSvg("download",12)}Export</button></div></header><div class="incident-table-content"></div></section></div></div>`;
        const barangayFilter = main.querySelector('[data-filter="barangay"]');
        const allBarangays = document.createElement("option");
        allBarangays.value = "";
        allBarangays.textContent = "All barangays";
        barangayFilter.replaceChildren(allBarangays, ...barangayNames.map((name) => {
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          return option;
        }));
        const filters = currentFilters();
        for (const [key, value] of Object.entries(filters)) {
          const control = main.querySelector(`[data-filter="${key}"]`);
          if (control) control.value = value;
        }
        const filterInput = main.querySelector('[data-filter="search"]');
        filterInput.addEventListener("input", () => {
          setFilters({ search: filterInput.value });
          page = 1;
          clearTimeout(searchTimer);
          searchTimer = setTimeout(() => { void refresh(); }, 250);
        });
        main.querySelectorAll("select[data-filter],input[type=date][data-filter]").forEach((input) => input.addEventListener("change", () => { setFilters({ [input.dataset.filter]: input.value }); page = 1; void refresh(); }));
        main.querySelector(".date-preset").addEventListener("change", (event) => {
          if (event.target.value === "custom") return;
          const end = new Date(); const start = new Date(end);
          if (event.target.value === "7d") start.setDate(start.getDate() - 7);
          else if (event.target.value === "30d") start.setDate(start.getDate() - 30);
          else { start.setFullYear(2024, 0, 1); end.setFullYear(2024, 8, 30); }
          setFilters({ from: start.toISOString().slice(0,10), to: end.toISOString().slice(0,10) }); page = 1; void refresh();
          main.querySelector('[data-filter="from"]').value = start.toISOString().slice(0,10);
          main.querySelector('[data-filter="to"]').value = end.toISOString().slice(0,10);
        });
        const reset = () => { history.replaceState(null, "", location.pathname); page = 1; main.querySelector(".date-preset").value = "custom"; for (const input of main.querySelectorAll("[data-filter]")) input.value = ""; void refresh(); };
        main.querySelector(".reset-filters").addEventListener("click", reset);
        main.querySelector(".clear-filters").addEventListener("click", reset);
        main.querySelector(".export-incidents").addEventListener("click", async () => {
          const button = main.querySelector(".export-incidents");
          button.disabled = true;
          try {
            const file = await exportIncidents(currentFilters());
            if (file?.content) {
              const blob = new Blob([file.content], { type: file.contentType || "text/csv;charset=utf-8" });
              const link = document.createElement("a");
              link.href = URL.createObjectURL(blob);
              link.download = file.fileName || "sigatacloban-incidents.csv";
              link.click();
              URL.revokeObjectURL(link.href);
            } else {
              downloadCsv(file?.fileName || "sigatacloban-incidents.csv", ["Incident ID", "Fire class", "Barangay", "Date", "Time", "Severity", "Response minutes", "Cause"], allRows.map((row) => [row.id,row.fireClass,row.barangay,row.date,row.time,row.severityLabel,row.responseMinutes,row.cause]));
            }
          } catch (error) {
            main.dispatchEvent(new CustomEvent("app:toast", { bubbles: true, detail: { message: error.message || "Incident export failed.", type: "error" } }));
          } finally { button.disabled = false; }
        });
        if (canManage) main.querySelector(".add-incident").addEventListener("click", () => openIncidentForm({ areas, initial: null, onSave: async (data) => { await createIncident(data); await refresh(); setSharedData({ incidentRefreshAt: Date.now() }); main.dispatchEvent(new CustomEvent("app:toast",{bubbles:true,detail:{message:"Incident added to the operations archive.",type:"success"}})); } }));
        void createMap(main.querySelector(".incident-side-map")).then((created) => {
          map = created.map;
          created.L.control.zoom({ position: "bottomright" }).addTo(map);
          markerLayer = created.L.layerGroup().addTo(map);
          updateMarkers(created.L);
          created.invalidateSize();
        });
      };
      const updateMarkers = (L) => {
        if (!markerLayer) return;
        markerLayer.clearLayers();
        markers.clear();
        for (const row of mapRows) {
          if (!Number.isFinite(Number(row.lat)) || !Number.isFinite(Number(row.lng))) continue;
          const marker = L.circleMarker([Number(row.lat), Number(row.lng)], {
            radius: selected?.id === row.id ? 9 : 6,
            color: selected?.id === row.id ? "#173f35" : "#ffffff",
            weight: selected?.id === row.id ? 3 : 2,
            fillColor: row.severity === "veryhigh" || row.severity === "high" ? "#d62828" : row.severity === "moderate" ? "#f4c430" : "#2e9e5b",
            fillOpacity: 0.9,
          }).addTo(markerLayer);
          marker.bindTooltip(`${row.id} · ${row.barangay}`);
          marker.on("click", () => openDetails(row));
          markers.set(row.id, marker);
        }
      };
      const paintRows = (total) => {
        const content = main.querySelector(".incident-table-content");
        if (!content) return;
        main.querySelector(".incident-count").textContent = `${total} incidents`;
        main.querySelector(".clear-filters").disabled = !Object.values(currentFilters()).some(Boolean);
        const pages = Math.max(1, Math.ceil(total / pageSize));
        const rows = allRows;
        if (!total) {
          content.innerHTML = `<div class="incident-empty-table"><div class="empty-state"><span class="empty-icon">${iconSvg("flame", 16)}</span><b>No incidents match these filters</b><small>Try another date range, barangay or severity.</small></div></div>`;
          return;
        }
        if (innerWidth < 768) {
          content.innerHTML = `<div class="incident-mobile-list">${rows.map((row) => `<button class="incident-mobile-row${selected?.id === row.id ? " selected" : ""}" data-row="${escape(row.id)}"><span><b>${escape(row.id)}</b><small>${escape(row.fireClass)} · ${escape(row.barangay)}</small></span><span class="risk-chip risk-${row.severity}">${escape(row.severityLabel)}</span><small>${row.responseMinutes} min ›</small></button>`).join("")}</div>${pagination(total,pages)}`;
        } else {
          content.innerHTML = `<div class="incident-table-scroll"><table class="incident-table"><thead><tr>${[["id","Incident"],["barangay","Location"],["date","Date & time"],["severity","Severity"],["responseMinutes","Response"]].map(([key,label])=>`<th><button class="sort-header" data-sort="${key}">${label}${sort.key===key?(sort.direction==="asc"?" ↑":" ↓"):""}</button></th>`).join("")}<th><span class="sr-only">Open details</span></th></tr></thead><tbody>${rows.map((row)=>`<tr tabindex="0" class="${selected?.id === row.id ? "selected" : ""}" data-row="${escape(row.id)}"><td><b>${escape(row.id)}</b><small>${escape(row.fireClass)}</small></td><td>${escape(row.barangay)}</td><td>${escape(row.date)} · ${escape(row.time)}</td><td><span class="risk-chip risk-${row.severity}">${escape(row.severityLabel)}</span></td><td>${row.responseMinutes} min</td><td>›</td></tr>`).join("")}</tbody></table></div>${pagination(total,pages)}`;
        }
        content.querySelectorAll("[data-row]").forEach((row) => row.addEventListener("click", () => {
          const incident = mapRows.find((item) => item.id === row.dataset.row) || allRows.find((item) => item.id === row.dataset.row);
          if (incident) {
            selected = incident;
            updateMarkers(window.L);
            map?.setView([Number(incident.lat), Number(incident.lng)], Math.max(map.getZoom(), 14));
            openDetails(incident);
          }
        }));
        content.querySelectorAll("[data-sort]").forEach((button) => button.addEventListener("click", () => {
          const key = button.dataset.sort;
          sort = { key, direction: sort.key === key && sort.direction === "desc" ? "asc" : "desc" };
          const params = new URLSearchParams(location.search); params.set("sort",sort.key);params.set("dir",sort.direction);params.delete("page");history.pushState(null,"",`${location.pathname}?${params}`);page=1;void refresh();
        }));
        content.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => { page = Number(button.dataset.page); const params = new URLSearchParams(location.search);params.set("page",String(page));history.pushState(null,"",`${location.pathname}?${params}`);void refresh(); }));
      };
      const pagination = (total, pages) => `<footer class="incident-pagination"><small>Showing ${(page-1)*pageSize+1}-${Math.min(page*pageSize,total)} of ${total}</small><div><button data-page="${Math.max(1,page-1)}" aria-label="Previous page" ${page<=1?"disabled":""}>‹</button><span>Page ${page} of ${pages}</span><button data-page="${Math.min(pages,page+1)}" aria-label="Next page" ${page>=pages?"disabled":""}>›</button></div></footer>`;
      const openDetails = (row) => {
        if (!row) return;
        selected = row;
        updateMarkers(window.L);
        paintRows(totalRows);
        const detail = document.createElement("div"); detail.className="incident-detail";
        detail.innerHTML=`<span class="eyebrow">${escape(row.id)}</span><h3>${escape(row.fireClass)} fire</h3><p>${escape(row.barangay)}, Tacloban City</p><div><span class="risk-chip risk-${row.severity}">${escape(row.severityLabel)}</span><span>${escape(row.status)}</span></div><dl><dt>Date &amp; time</dt><dd>${escape(row.date)} · ${escape(row.time)}</dd><dt>Cause</dt><dd>${escape(row.cause)}</dd><dt>Response</dt><dd>${row.responseMinutes} minutes</dd><dt>Notes</dt><dd>${escape(row.notes)}</dd></dl><div class="incident-detail-map"></div>${canManage?'<div class="incident-detail-actions"><button class="button button-secondary edit-incident">Edit incident</button><button class="button button-ghost delete-incident">Delete</button></div>':""}`;
        drawerClose=openOverlay({title:"Incident details",kind:"drawer",content:detail,confirmLabel:"Close"});
        void createMap(detail.querySelector(".incident-detail-map"),{zoom:14}).then(({map:detailMap})=>{detailMap.setView([row.lat,row.lng],14);});
        detail.querySelector(".edit-incident")?.addEventListener("click",()=>openIncidentForm({areas,initial:row,onSave:async(data)=>{await updateIncident(row.id,data);await refresh();setSharedData({incidentRefreshAt:Date.now()});drawerClose?.();}}));
        detail.querySelector(".delete-incident")?.addEventListener("click",async()=>{if(confirm("Delete this incident?")){try{await deleteIncident(row.id);selected=null;await refresh();setSharedData({incidentRefreshAt:Date.now()});drawerClose?.();}catch(error){main.dispatchEvent(new CustomEvent("app:toast",{bubbles:true,detail:{message:error.message||"Incident could not be deleted.",type:"error"}}));}}});
      };
      const openIncidentForm = async ({areas,initial,onSave}) => {
        const content=document.createElement("form");
        content.className="incident-form-grid";
        content.id=`incident-form-${Date.now()}`;
        content.noValidate=true;
        const details=document.createElement("section");
        details.className="incident-form-section";
        details.innerHTML='<h3>Incident details</h3>';
        let fieldIndex=0;
        const fieldRow=(className="")=>{const row=document.createElement("div");row.className=`incident-form-row ${className}`.trim();details.append(row);return row;};
        const createField=(labelText,control,{required=false,typeName=control.tagName.toLowerCase()}={})=>{
          const wrapper=document.createElement("div");
          wrapper.className="incident-field";
          const id=`incident-${typeName}-${++fieldIndex}`;
          const label=document.createElement("label");label.htmlFor=id;label.textContent=labelText;
          if(required){const star=document.createElement("span");star.className="required-mark";star.setAttribute("aria-hidden","true");star.textContent=" *";label.append(star);control.required=true;}
          control.id=id;control.setAttribute("aria-describedby",`${id}-error`);
          const error=document.createElement("small");error.id=`${id}-error`;error.className="incident-field-error";error.hidden=true;
          wrapper.append(label,control,error);
          return {wrapper,control,error};
        };
        const areaSelect=makeSelect(barangayNames,initial?.barangay??"","Select barangay");
        const classSelect=makeSelect(fireClasses,initial?.fireClass??"Residential");
        const severitySelect=makeSelect(severities,initial?.severityLabel??"High");
        areaSelect.name="barangay";classSelect.name="fireClass";severitySelect.name="severity";
        const date=document.createElement("input");date.type="date";date.value=initial?.date??new Date().toISOString().slice(0,10);
        const cause=document.createElement("input");cause.placeholder="e.g. Electrical short circuit";cause.minLength=2;cause.value=initial?.cause??"";
        const time=document.createElement("input");time.type="time";time.value=initial?.time??"14:30";
        const response=document.createElement("input");response.type="number";response.min="1";response.max="180";response.value=initial?.responseMinutes??7;
        date.name="date";cause.name="cause";time.name="time";response.name="responseMinutes";
        const barangayField=createField("Barangay",areaSelect,{required:true});
        const classField=createField("Fire class",classSelect,{required:true});
        const severityField=createField("Severity",severitySelect,{required:true});
        const dateField=createField("Date",date,{required:true});
        const causeField=createField("Cause",cause,{required:true});
        const timeField=createField("Time",time,{required:true});
        const responseField=createField("Response time (minutes)",response,{required:true});
        for(const item of [barangayField,classField,severityField,dateField,causeField,timeField,responseField]){
          item.control.addEventListener("input",()=>{if(item.control.checkValidity()){item.error.hidden=true;item.control.setAttribute("aria-invalid","false");item.wrapper.classList.remove("has-error");}});
          item.control.addEventListener("change",()=>{if(item.control.checkValidity()){item.error.hidden=true;item.control.setAttribute("aria-invalid","false");item.wrapper.classList.remove("has-error");}});
        }
        fieldRow().append(barangayField.wrapper,classField.wrapper);
        fieldRow("incident-form-row-three").append(severityField.wrapper,dateField.wrapper,causeField.wrapper);
        fieldRow().append(timeField.wrapper,responseField.wrapper);
        content.append(details);
        const notesSection=document.createElement("section");notesSection.className="incident-form-section";
        const notes=document.createElement("textarea");notes.rows=3;notes.maxLength=500;notes.placeholder="Add incident notes";notes.value=initial?.notes??"";
        notes.name="notes";
        const notesField=createField("Notes",notes,{typeName:"notes"});
        const notesHeading=document.createElement("h3");notesHeading.textContent="Notes";
        const counter=document.createElement("small");counter.className="incident-notes-counter";counter.textContent=`${notes.value.length}/500`;
        notesField.wrapper.append(counter);notesSection.append(notesHeading,notesField.wrapper);content.append(notesSection);
        notes.addEventListener("input",()=>{counter.textContent=`${notes.value.length}/500`;});
        const locationSection=document.createElement("section");locationSection.className="incident-form-section location-picker";
        locationSection.innerHTML=`<h3>Location</h3><b class="location-picker-title">Pick location on map</b><small class="location-picker-help">Click the map to place the pin.</small><div class="location-picker-map"></div><div class="location-picker-meta"><span class="picked-location"></span><button type="button" class="reset-location">Reset to barangay center</button></div>`;
        content.append(locationSection);
        let chosenPoint=initial?[initial.lat,initial.lng]:[11.246,125.018];
        let picker;
        let pickerReady=false;
        let pickMap;
        const updateCoordinate=(coords)=>{chosenPoint=coords;locationSection.querySelector(".picked-location").textContent=`Lat ${coords[0].toFixed(5)}, Lng ${coords[1].toFixed(5)}`;void reverseGeocode(coords[0],coords[1]).then((result)=>{const areaName=result?.barangay;if(areaName&&[...areaSelect.options].some((option)=>option.value===areaName))areaSelect.value=areaName;}).catch((error)=>console.warn("Incident location reverse geocoding failed.",error));};
        const footer=document.createElement("footer");footer.className="modal-fixed-footer incident-form-actions";
        const cancel=document.createElement("button");cancel.type="button";cancel.className="button button-secondary overlay-cancel";cancel.textContent="Cancel";
        const save=document.createElement("button");save.type="submit";save.className="button button-primary";save.textContent=initial?"Save changes":"Add incident";
        save.setAttribute("form",content.id);
        footer.append(cancel,save);
        let dirty=false;
        let saving=false;
        let pickerDestroyed=false;
        let destroyPickerMap=null;
        content.addEventListener("input",()=>{dirty=true;});
        content.addEventListener("change",(event)=>{dirty=true;if(event.target===areaSelect){const area=areas.find(item=>item.name===areaSelect.value);if(area?.center){pickMap?.setView(area.center,14);picker?.setPoint(area.center);}}});
        content.addEventListener("keydown",(event)=>{if(event.key==="Enter"&&event.target instanceof HTMLSelectElement)event.preventDefault();});
        const close=openOverlay({title:initial?"Edit incident":"Add incident",subtitle:"Record a fire incident for the archive.",content,footer,initialFocus:barangayField.control,canClose:()=>!saving&&(!dirty||window.confirm("Discard your unsaved incident changes?")),onClose:()=>{pickerDestroyed=true;picker?.destroy();destroyPickerMap?.();}});
        document.querySelector(".modal-panel")?.classList.add("incident-form-modal");
        const mapCreated=await createMap(locationSection.querySelector(".location-picker-map"),{zoom:14});
        destroyPickerMap=mapCreated.destroy;
        if(pickerDestroyed){destroyPickerMap();return;}
        pickMap=mapCreated.map;
        mapCreated.L.control.zoom({position:"bottomright"}).addTo(pickMap);
        if(initial?.lat&&initial?.lng)pickMap.setView([initial.lat,initial.lng],14);
        picker=await createLocationPicker(pickMap,{initialPoint:chosenPoint,onChange:(coords)=>{if(coords){if(pickerReady)dirty=true;updateCoordinate(coords);}}});
        pickerReady=true;
        locationSection.querySelector(".reset-location").addEventListener("click",()=>{const area=areas.find(item=>item.name===areaSelect.value);const center=area?.center??[11.2444,125.0036];pickMap.setView(center,14);dirty=true;picker.setPoint(center);});
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,180))));
        pickMap.invalidateSize({animate:false,pan:false});
        content.addEventListener("submit",async(event)=>{
          event.preventDefault();
          let valid=true;
          for(const item of [barangayField,classField,severityField,dateField,causeField,timeField,responseField]){
            const control=item.control;
            const message=control.validity.valueMissing?"This field is required.":control.validity.tooShort?"Enter at least 2 characters.":control.validity.rangeUnderflow||control.validity.rangeOverflow?"Enter a response time between 1 and 180 minutes.":"";
            item.error.textContent=message;item.error.hidden=!message;control.setAttribute("aria-invalid",String(Boolean(message)));item.wrapper.classList.toggle("has-error",Boolean(message));
            if(message)valid=false;
          }
          if(!valid){[barangayField,classField,severityField,dateField,causeField,timeField,responseField].find(item=>!item.control.checkValidity())?.control.focus();return;}
          saving=true;save.disabled=true;save.textContent="Saving…";
          try{const area=areas.find(item=>item.name===areaSelect.value);await onSave({barangay:areaSelect.value,fireClass:classSelect.value,severityLabel:severitySelect.value,severity:severityLevel[severitySelect.value],class:classSelect.value,date:date.value,time:time.value.length===5?`${time.value}:00`:time.value,cause:cause.value,responseMinutes:Number(response.value),notes:notes.value,lat:chosenPoint[0],lng:chosenPoint[1],areaId:area?.id??""});dirty=false;close();}
          catch(error){saving=false;save.disabled=false;save.textContent=initial?"Save changes":"Add incident";const fieldErrors=renderFieldErrors(content,error.details);if(!fieldErrors.length)main.dispatchEvent(new CustomEvent("app:toast",{bubbles:true,detail:{message:error.message||"Incident could not be saved.",type:"error"}}));}
        });
      };
      renderPage();
      incidentLoader = loadPageData(async (filters, requestedPage, requestedPageSize, requestedSort, signal) => {
        const [pageResult, mapResult] = await Promise.all([
          listIncidents(filters, requestedPage, requestedPageSize, requestedSort, { signal }),
          listIncidents(filters, 1, 1000, requestedSort, { signal }),
        ]);
        return { pageResult, mapResult };
      }, [], {
        container: main.querySelector(".incident-table-content"),
        loading(container) {
          container.innerHTML = '<div class="skeleton incident-table-skeleton" aria-label="Loading incidents"></div>';
        },
        success(_container, result) {
          allRows = result.pageResult.rows;
          mapRows = result.mapResult.rows;
          totalRows = result.pageResult.total;
          page = result.pageResult.page;
          paintRows(totalRows);
          updateMarkers(window.L);
        },
        error(container, error, retry) {
          container.innerHTML = `<div class="query-error" role="alert"><b>Incidents could not be loaded.</b><small>${escape(error.message || "Check the connection and retry.")}</small><button type="button" class="button button-primary">Retry</button></div>`;
          container.querySelector("button").addEventListener("click", () => { void retry(); });
        },
      });
      await refresh();
    } catch (error) {
      console.error("Unable to load the incident archive.", error);
      main.innerHTML=`<div class="phase4-page"><div class="query-error" role="alert"><b>Incident archive data could not be loaded.</b><button class="button button-primary">Retry</button></div></div>`;
      main.querySelector("button").addEventListener("click",loadData);
    }
  };
  await loadData();
}
