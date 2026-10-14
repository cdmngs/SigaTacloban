import { listReports, createReport, deleteReport, duplicateReportSettings } from "../api/reports.js";
import { fetchRiskAreas } from "../api/risk.js";
import { fetchWeatherAnalysis } from "../api/weatherAnalysis.js";
import { getCoverage } from "../api/coverage.js";
import { listIncidents } from "../api/incidentsPartA.js";
import { loadChartJs } from "../charts/theme.js";
import { openOverlay } from "../ui/overlays.js";
import { escapeHtml } from "../utils/dom.js";
import { iconSvg } from "../ui/icons.js";

const styles=["phase4-pages.css","reports.css"];
const sections=[
  ["executiveSummary","Executive summary"],["cityRisk","City risk overview"],["highRiskAreas","Highest-risk barangays"],
  ["weather","Weather analysis"],["coverage","Station coverage"],["incidentHistory","Incident history"],
  ["trends","Trends"],["riskMap","Risk map snapshot"],["mlSummary","ML model summary"],["whatIf","What-If scenarios"],
];
const defaultSettings={title:"Tacloban City Fire Risk Assessment",dateStart:"2024-09-01",dateEnd:"2024-09-30",areaId:"",sections:["executiveSummary","cityRisk","highRiskAreas","weather","coverage","incidentHistory"]};
const esc=escapeHtml;
function ensureStyles(){for(const file of styles){const id=`phase4-${file}`;if(document.getElementById(id))continue;const link=document.createElement("link");link.id=id;link.rel="stylesheet";link.href=`assets/css/${file}`;document.head.append(link);}}
function loadVendor(id,src){
  const globalName=id==="jspdf"?"jspdf":id;
  if(window[globalName])return Promise.resolve(window[globalName]);
  return new Promise((resolve,reject)=>{const script=document.createElement("script");script.src=src;script.async=true;script.onload=()=>window[globalName]?resolve(window[globalName]):reject(new Error(`${id} failed to initialize`));script.onerror=()=>reject(new Error(`Could not load ${id}`));document.head.append(script);});
}

export async function mount(main,user){
  ensureStyles();main.innerHTML='<div class="phase4-page phase4-loading"><div class="skeleton phase4-title-skeleton"></div><div class="reports-skeleton"><div class="skeleton"></div><div class="skeleton"></div></div><div class="skeleton reports-past-skeleton"></div></div>';
  const retry=()=>mount(main,user);
  try{
    const [past,risk,weather,coverage,incidents]=await Promise.all([listReports(),fetchRiskAreas(),fetchWeatherAnalysis(),getCoverage(),listIncidents({search:"",barangay:"",from:"",to:"",fireClass:"",severity:""},1,10,{key:"date",direction:"desc"})]);
    render(main,user,{past,risk,weather,coverage,incidents});
  }catch(error){main.innerHTML='<div class="phase4-page"><div class="query-error" role="alert"><b>Report data could not be loaded.</b><button class="button button-primary">Retry</button></div></div>';main.querySelector("button").addEventListener("click",retry);}
}
function render(main,user,data){
  let settings={...defaultSettings,sections:[...defaultSettings.sections],areaId:new URLSearchParams(location.search).get("area")??""};
  let previewVersion=0,previewLoading=false,exporting=false,progress=0,menuReport=null,deleteTarget=null;
  const selectedArea=()=>data.risk.find((item)=>item.id===settings.areaId);
  const score=()=>selectedArea()?.score??0;
  const setDatePreset=(value)=>{const end=new Date();let start=new Date(end);if(value==="sept2024"){start=new Date("2024-09-01T12:00:00");end.setFullYear(2024,8,30);}else if(value==="ytd"){start=new Date(end.getFullYear(),0,1);}else start.setDate(end.getDate()-30);settings.dateStart=start.toISOString().slice(0,10);settings.dateEnd=end.toISOString().slice(0,10);};
  const paint=()=>{
    const month=new Date(`${settings.dateStart}T12:00:00`).toLocaleDateString("en-US",{month:"long",year:"numeric"});
    const pageCount=1+settings.sections.length;
    main.innerHTML=`<div class="phase4-page reports-page"><header class="phase4-heading"><div><span class="eyebrow">DECISION SUPPORT</span><h1>Reports</h1><p>Build and export official fire risk intelligence reports.</p></div><button class="button button-primary new-report">${iconSvg("plus",14)}New report</button></header><div class="report-workspace">
      <section class="card report-builder-card"><span class="eyebrow">CONFIGURE YOUR DOCUMENT</span><h2>Report builder</h2><label class="builder-label">Report title<input aria-label="Report title" value="${esc(settings.title)}"></label>
       <div class="builder-select-row"><label class="builder-label">Date range<select aria-label="Date range" class="date-range"><option value="custom">Custom range</option><option value="last30">Last 30 days</option><option value="sept2024">01 Sep – 30 Sep 2024</option><option value="ytd">Year to date</option></select></label><label class="builder-label">Area<select aria-label="Report area" class="report-area"><option value="">All barangays</option>${data.risk.map((area)=>`<option value="${esc(area.id)}" ${area.id===settings.areaId?"selected":""}>${esc(area.name)}</option>`).join("")}</select></label></div>
       <span class="builder-section-label">Include sections</span><div class="report-section-checks">${sections.map(([key,label])=>`<label><input type="checkbox" data-section="${key}" ${settings.sections.includes(key)?"checked":""}><span class="custom-check">✓</span>${label}</label>`).join("")}</div><button class="button button-primary update-preview-button">${iconSvg("refresh",14)}Update preview</button></section>
      <section class="report-preview-panel" aria-label="Live report preview"><header><div><b>Live preview</b><small>${pageCount} pages · A4</small></div><button class="button button-primary export-pdf" ${exporting?"disabled":""}>${exporting?`Exporting ${progress}%…`:"Export PDF"}</button></header>${exporting?`<div class="export-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div>`:""}${previewLoading?'<div class="preview-loading"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>':`<div class="report-pages-scroll" data-version="${previewVersion}"><article class="report-page report-cover-page"><div class="report-paper-brand"><span class="report-logo"><img src="assets/img/logo.png" alt="SigaTacloban" width="34"></span><strong>BUREAU OF FIRE PROTECTION</strong></div><div class="report-cover-content"><span class="report-eyebrow">MONTHLY INTELLIGENCE REPORT</span><h2>${esc(settings.title)}</h2><p>${month}</p><div class="cover-risk-box${selectedArea() ? "" : " cover-risk-no-data"}">${selectedArea()?`<strong>${score()}<small>/100</small></strong><span><b>${riskLevel(score())} city risk</b><small>No risk data available</small></span>`:'<span><b class="cover-risk-neutral-chip">No data</b></span>'}</div></div><footer>Prepared for BFP Tacloban City - SigaTacloban Decision Support</footer></article>${settings.sections.map((key)=>`<article class="report-page report-section-page"><header class="report-paper-brand"><span class="report-logo"><img src="assets/img/logo.png" alt="SigaTacloban" width="28"></span><strong>BUREAU OF FIRE PROTECTION</strong></header><h2>${esc(sections.find(([item])=>item===key)?.[1]??key)}</h2><p>No data available.</p><footer>Risk estimates, not exact predictions of future fires.</footer></article>`).join("")}</div>`}</section></div>
      <section class="card past-reports-card"><span class="eyebrow">RECENTLY GENERATED</span><h2>Past reports</h2><div class="past-report-list">${data.past.length?data.past.map((report)=>`<article class="past-report-row" data-report="${esc(report.id)}"><span>${iconSvg("file",15)}</span><div><b>${esc(report.title)}</b><small>PDF · ${esc(report.sizeLabel)} · Generated by ${esc(report.generatedBy)}</small></div><time>${new Date(report.generatedAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</time><button aria-label="Download ${esc(report.title)}" data-download="${esc(report.id)}">${iconSvg("download",13)}</button><div class="past-report-menu"><button aria-label="More actions for ${esc(report.title)}" data-menu="${esc(report.id)}">⋯</button>${menuReport===report.id?`<div><button data-duplicate="${esc(report.id)}">Duplicate settings</button><button data-delete="${esc(report.id)}">Delete</button></div>`:""}</div></article>`).join(""):'<p class="empty-list-state">No past reports yet.</p>'}</div></section></div>`;
    main.querySelector(".new-report").addEventListener("click",()=>{settings={...defaultSettings,sections:[...defaultSettings.sections],areaId:new URLSearchParams(location.search).get("area")??""};previewVersion++;paint();});
    main.querySelector('[aria-label="Report title"]').addEventListener("input",(event)=>{settings.title=event.target.value;});
    main.querySelector(".report-area").addEventListener("change",(event)=>{settings.areaId=event.target.value;paint();});
    main.querySelector(".date-range").addEventListener("change",(event)=>{if(event.target.value!=="custom"){setDatePreset(event.target.value);paint();}});
    main.querySelectorAll("[data-section]").forEach((input)=>input.addEventListener("change",()=>{settings.sections=input.checked?[...new Set([...settings.sections,input.dataset.section])]:settings.sections.filter((item)=>item!==input.dataset.section);paint();}));
    main.querySelector(".update-preview-button").addEventListener("click",()=>{previewLoading=true;paint();window.setTimeout(()=>{previewLoading=false;previewVersion++;paint();},450);});
    main.querySelector(".export-pdf").addEventListener("click",()=>{void exportPdf(main,user,data,settings,()=>{exporting=true;progress=15;paint();},(next)=>{progress=next;const bar=main.querySelector(".export-progress span");if(bar)bar.style.width=`${next}%`;const btn=main.querySelector(".export-pdf");if(btn)btn.textContent=`Exporting ${next}%…`;},()=>{exporting=false;progress=0;paint();});});
    main.querySelectorAll("[data-menu]").forEach((button)=>button.addEventListener("click",()=>{menuReport=menuReport===button.dataset.menu?null:button.dataset.menu;paint();}));
    main.querySelectorAll("[data-duplicate]").forEach((button)=>button.addEventListener("click",()=>{const saved=duplicateReportSettings(button.dataset.duplicate);if(saved){settings=saved;paint();}menuReport=null;}));
    main.querySelectorAll("[data-delete]").forEach((button)=>button.addEventListener("click",()=>{deleteTarget=data.past.find((report)=>report.id===button.dataset.delete);if(deleteTarget)confirmDelete(main,data,deleteTarget,()=>{deleteTarget=null;});}));
    main.querySelectorAll("[data-download]").forEach((button)=>button.addEventListener("click",()=>downloadPast(main,data.past.find((report)=>report.id===button.dataset.download))));
  };
  paint();
}
function riskLevel(value){return value>=80?"Very high":value>=65?"High":value>=40?"Moderate":"Low";}
async function exportPdf(main,user,data,settings,onStart,onProgress,onFinish){
  onStart();
  try{
    const jsPDF=await loadVendor("jspdf","assets/vendor/jspdf.umd.min.js");
    const html2canvas=await loadVendor("html2canvas","assets/vendor/html2canvas.min.js");
    const pdf=new jsPDF.jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
    const pages=[...main.querySelectorAll(".report-page")];
    for(let i=0;i<pages.length;i++){if(i)pdf.addPage();const canvas=await html2canvas(pages[i],{scale:1,backgroundColor:"#ffffff",onclone:(clonedDocument)=>clonedDocument.querySelectorAll(".report-page").forEach((reportPage)=>{reportPage.style.boxShadow="none";})});pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,210,297);onProgress(20+Math.round((i+1)/pages.length*60));}
    const report=await createReport(settings,user?.name??"BFP User");onProgress(95);pdf.save(report.fileName);onProgress(100);
    main.dispatchEvent(new CustomEvent("app:toast",{bubbles:true,detail:{message:"PDF exported and added to Past reports.",type:"success"}}));
    const updated=await listReports();data.past.splice(0,data.past.length,...updated);
  }catch(error){console.error("Report PDF export failed.",error);main.dispatchEvent(new CustomEvent("app:toast",{bubbles:true,detail:{message:"PDF export failed. Please try again.",type:"error"}}));}
  finally{onFinish();}
}
async function downloadPast(main,report){
  if(!report)return;
  try{const jsPDF=await loadVendor("jspdf","assets/vendor/jspdf.umd.min.js");const pdf=new jsPDF.jsPDF({orientation:"portrait",unit:"mm",format:"a4"});pdf.setFontSize(18);pdf.text(report.title,20,40);pdf.setFontSize(10);pdf.text(`Generated ${new Date(report.generatedAt).toLocaleDateString()} by ${report.generatedBy}`,20,55);pdf.text(`Date range: ${report.settings.dateStart} – ${report.settings.dateEnd}`,20,65);pdf.save(report.fileName);}
  catch(error){main.dispatchEvent(new CustomEvent("app:toast",{bubbles:true,detail:{message:"PDF download failed. Please try again.",type:"error"}}));}
}
function confirmDelete(main,data,report,after){
  const content=document.createElement("p");content.textContent=`Delete ${report.title} from the list?`;
  openOverlay({title:"Delete past report?",content,kind:"confirm",confirmLabel:"Delete report",onConfirm:async()=>{await deleteReport(report.id);data.past.splice(data.past.indexOf(report),1);after();main.dispatchEvent(new CustomEvent("app:toast",{bubbles:true,detail:{message:"Past report deleted.",type:"success"}}));}});
}
