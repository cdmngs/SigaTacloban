import { listAlerts, getAlertRules, acknowledgeAlert, markAllRead, saveAlertRules } from "../api/alerts.js";
import { openOverlay } from "../ui/overlays.js";
import { iconSvg } from "../ui/icons.js";
import { escapeHtml } from "../utils/dom.js";
import { loadData, renderFieldErrors } from "../core/data-state.js";
import { appStore, setSharedData, subscribeToSharedData } from "../core/store.js";
import { roleLabels, rolePermissions } from "../core/permissions.js";
import { formatDateTime, formatNumber, formatValue } from "../utils/format.js";

const styles=["phase4-pages.css","alerts.css"];
const tabs=[["all","All alerts"],["critical","Critical"],["warnings","Warnings"],["system","System"]];
const esc=escapeHtml;
function ensureStyles(){for(const file of styles){const id=`phase4-${file}`;if(document.getElementById(id))continue;const link=document.createElement("link");link.id=id;link.rel="stylesheet";link.href=`assets/css/${file}`;document.head.append(link);}}

export async function mount(main){
  ensureStyles();
  let state;
  state=loadData(async(signal)=>{
    const [alerts,rules]=await Promise.all([listAlerts({signal}),getAlertRules({signal})]);
    return {alerts,rules};
  },[],{
    container:main,minHeight:420,errorTitle:"Alerts and notification rules could not be loaded.",
    success:(_container,result)=>render(main,result.alerts,result.rules),
    empty:(_container,result)=>render(main,result.alerts||[],result.rules||{}),
    error:(container,error,retry)=>{
      container.innerHTML=`<div class="phase4-page"><div class="query-error" role="alert"><b>${esc(error.message||"Alerts and notification rules could not be loaded.")}</b><button class="button button-primary">Retry</button></div></div>`;
      container.querySelector("button").addEventListener("click",()=>{void retry();});
    },
  });
  await state.load();
}
function render(main,alerts,initialRules){
  const sourceRules=initialRules&&typeof initialRules==="object"?initialRules:{};
  let rules={
    moderateThreshold:Number.isFinite(sourceRules.moderateThreshold)?sourceRules.moderateThreshold:40,
    highThreshold:Number.isFinite(sourceRules.highThreshold)?sourceRules.highThreshold:60,
    veryHighThreshold:Number.isFinite(sourceRules.veryHighThreshold)?sourceRules.veryHighThreshold:80,
    channels:sourceRules.channels||{inApp:true,email:false,sms:false},
    quietHours:Boolean(sourceRules.quietHours),
    recipients:sourceRules.recipients||{admin:true,operations:true,prevention:true,analyst:false},
  };
  let activeTab="all";let search="";let severity="";let expanded=new Set();
  let alertRows=[...alerts];
  const canEditRules=Boolean(rolePermissions[appStore.getState().currentUser?.role]?.capabilities?.alertRules);
  const syncShared=()=>setSharedData({notifications:alertRows,alertCount:alertRows.filter((alert)=>!alert.read).length});
  const updateThresholds=(next)=>setSharedData({riskThresholds:{moderate:next.moderateThreshold,high:next.highThreshold,veryHigh:next.veryHighThreshold}});
  syncShared();
  setSharedData({riskThresholds:{moderate:rules.moderateThreshold,high:rules.highThreshold,veryHigh:rules.veryHighThreshold}});
  main.innerHTML=`<div class="phase4-page alerts-page"><header class="phase4-heading"><div><span class="eyebrow">OPERATIONS CENTER</span><h1>Alerts &amp; notifications</h1><p>Review model-generated warnings and system updates.</p></div><div class="alerts-header-actions"><button class="button button-secondary button-sm mark-read">${iconSvg("check",13)}Mark all read</button>${canEditRules?`<button class="button button-primary button-sm alert-rules">${iconSvg("sliders",13)}Alert rules</button>`:""}</div></header>
    <div class="alerts-toolbar"><div class="alert-tabs" role="tablist" aria-label="Alert category">${tabs.map(([key,label])=>`<button role="tab" aria-selected="${key==="all"}" class="${key==="all"?"active":""}" data-tab="${key}">${label}<span>${countFor(alertRows,key)}</span></button>`).join("")}</div><div class="alert-filters"><label class="alert-search"><span class="sr-only">Search alerts</span><input placeholder="Search alerts..."></label><label><span class="sr-only">Filter alert severity</span><select class="severity-filter"><option value="">All severity</option><option value="veryhigh">Very high</option><option value="high">High</option><option value="moderate">Moderate</option><option value="low">Low</option></select></label></div></div><div class="alert-card-list" aria-live="polite"></div></div>`;
  const list=main.querySelector(".alert-card-list");
  const filtered=()=>alertRows.filter((alert)=>{if(activeTab==="critical"&&!["high","veryhigh"].includes(alert.level))return false;if(activeTab==="warnings"&&alert.type==="system")return false;if(activeTab==="system"&&alert.type!=="system")return false;if(severity&&alert.level!==severity)return false;const term=search.trim().toLowerCase();return !term||`${alert.area??""} ${alert.message} ${(alert.topFactors??[]).join(" ")}`.toLowerCase().includes(term);});
  const paint=()=>{const items=filtered();list.innerHTML=items.length?items.map((alert)=>alertCard(alert,expanded.has(alert.id))).join(""):`<section class="card alerts-empty"><div class="empty-state"><span class="empty-icon">${iconSvg("bell",16)}</span><b>${alertRows.length?"You\'re all caught up":"No alerts yet"}</b><small>${alertRows.length?"No notifications match the current filters.":"New alerts will appear here."}</small></div></section>`;main.querySelectorAll("[data-tab] span").forEach((node)=>{node.textContent=String(countFor(alertRows,node.closest("[data-tab]").dataset.tab));});list.querySelectorAll("[data-expand]").forEach((button)=>button.addEventListener("click",()=>{const id=button.dataset.expand;expanded.has(id)?expanded.delete(id):expanded.add(id);paint();}));list.querySelectorAll("[data-ack]").forEach((button)=>button.addEventListener("click",()=>{void ack(button.dataset.ack);}));list.querySelectorAll("[data-area]").forEach((link)=>link.addEventListener("click",()=>setSharedData({selectedBarangay:link.dataset.area})) );};
  const ack=async(id)=>{
    const prior=alertRows;
    alertRows=alertRows.map((alert)=>alert.id===id?{...alert,acknowledged:true,read:true}:alert);
    syncShared();paint();
    try{
      const currentUser=appStore.getState().currentUser;
      const updated=await acknowledgeAlert(id,currentUser?.id||currentUser?.name||"");
      alertRows=alertRows.map((alert)=>alert.id===id?{...alert,...updated,acknowledged:true,read:true}:alert);
      syncShared();paint();
    }catch(error){
      alertRows=prior;syncShared();paint();
      main.dispatchEvent(new CustomEvent("app:toast",{bubbles:true,detail:{message:error.message||"Alert could not be acknowledged.",type:"error"}}));
    }
  };
  main.querySelectorAll("[data-tab]").forEach((button)=>button.addEventListener("click",()=>{activeTab=button.dataset.tab;main.querySelectorAll("[data-tab]").forEach((item)=>{const current=item===button;item.classList.toggle("active",current);item.setAttribute("aria-selected",String(current));});paint();}));
  main.querySelector(".alert-search input").addEventListener("input",(event)=>{search=event.target.value;paint();});
  main.querySelector(".severity-filter").addEventListener("change",(event)=>{severity=event.target.value;paint();});
  main.querySelector(".mark-read").addEventListener("click",async()=>{
    const prior=alertRows;alertRows=alertRows.map((alert)=>({...alert,read:true}));syncShared();paint();
    try{await markAllRead();main.dispatchEvent(new CustomEvent("app:toast",{bubbles:true,detail:{message:"All alerts marked as read.",type:"success"}}));}
    catch(error){alertRows=prior;syncShared();paint();main.dispatchEvent(new CustomEvent("app:toast",{bubbles:true,detail:{message:error.message||"Alerts could not be updated.",type:"error"}}));}
  });
  main.querySelector(".alert-rules")?.addEventListener("click",()=>openRules(main,rules,(next)=>{rules=next;updateThresholds(next);}));
  const unsubscribe=subscribeToSharedData("notifications",(notifications)=>{if(!Array.isArray(notifications)||notifications===alertRows)return;alertRows=[...notifications];paint();});
  window.addEventListener("pagehide",unsubscribe,{once:true});
  paint();
}
function countFor(alerts,key){if(key==="all")return alerts.length;if(key==="critical")return alerts.filter((alert)=>["high","veryhigh"].includes(alert.level)).length;if(key==="system")return alerts.filter((alert)=>alert.type==="system").length;return alerts.filter((alert)=>alert.type!=="system").length;}
function alertCard(alert,isExpanded){
  const createdAt=new Date(alert.createdAt).getTime();
  const age=Number.isFinite(createdAt)?Math.max(1,Math.floor((Date.now()-createdAt)/60000)):null;
  const ageLabel=age===null?"":age<60?`${age} min ago`:`${Math.floor(age/60)} hrs ago`;
  const weather=alert.weather||{};
  const temp=formatValue(weather.temperatureC),humidity=formatValue(weather.humidityPercent),wind=formatValue(weather.windKph);
  return `<article class="card operational-alert ${alert.read?"":"is-unread"} level-${esc(alert.level)}"><span class="alert-icon-tile">${iconSvg(alert.type==="system"?"shield":"bell",16)}</span><div class="alert-body"><div class="alert-eyebrow">${alert.type==="system"?"SYSTEM UPDATE":alert.type==="risk alert"?"NEW RISK ALERT":"RISK UPDATE"}${ageLabel?` · ${ageLabel.toUpperCase()}`:""}</div><div class="alert-title-line"><h2>${esc(formatValue(alert.message))}</h2>${alert.read?"":'<i class="alert-unread-dot"></i>'}</div>${alert.topFactors?.length?`<p class="alert-factors">Top factors: ${alert.topFactors.map(esc).join(", ")}.</p>`:""}<div class="alert-weather-chips"><span>${iconSvg("thermometer",12)} ${temp==="—"?temp:`${temp}°C`}</span><span>${iconSvg("droplet",12)} ${humidity==="—"?humidity:`${humidity}%`}</span><span>${iconSvg("wind",12)} ${wind==="—"?wind:`${wind} km/h`}</span></div>${isExpanded?`<div class="alert-expanded"><p>${esc(formatValue(alert.message))}. Current score is ${formatNumber(alert.score)}${alert.area?` for ${esc(alert.area)}`:""}.</p><p>${esc(formatDateTime(alert.createdAt))}</p></div>`:""}<button class="alert-expand-button" data-expand="${esc(alert.id)}">${isExpanded?"Hide details":"Show details"}</button></div><div class="alert-score"><strong>${formatNumber(alert.score)}</strong></div><div class="alert-actions">${alert.acknowledged?'<span class="acknowledged-label">✓ Acknowledged</span>':`<button class="button button-secondary button-sm" data-ack="${esc(alert.id)}">Acknowledge</button>`}${alert.areaId?`<a class="button button-primary button-sm" data-area="${esc(alert.areaId)}" href="risk-map.html?area=${encodeURIComponent(alert.areaId)}">View on map</a>`:'<span class="system-alert-label">System</span>'}</div></article>`;
}
function openRules(main,current,onUpdate){
  const rules=structuredClone(current);const content=document.createElement("form");content.className="alert-rules-content";content.noValidate=true;
  content.addEventListener("submit",(event)=>event.preventDefault());
  const channels=Object.keys(rules.channels||{});
  const recipients=Object.keys(rules.recipients||{});
  const channelLabels={inApp:"In-app notifications",email:"Email",sms:"SMS"};
  const thresholdFields=[["moderateThreshold","Moderate",20,70],["highThreshold","High",40,85],["veryHighThreshold","Very high",60,95]];
  content.innerHTML=`<p class="rules-intro">Choose when SigaTacloban notifies your response team.</p><section class="rule-thresholds" aria-label="Risk score thresholds"><span class="eyebrow">RISK SCORE THRESHOLDS</span>${thresholdFields.map(([key,label,min,max])=>`<label class="slider-field rule-threshold-row"><b>${label}</b><input type="range" name="${key}" data-rule="${key}" min="${min}" max="${max}" value="${rules[key]}" style="--range-progress:${((rules[key]-min)/(max-min))*100}%"><output class="rule-value">${rules[key]}</output></label>`).join("")}<small class="threshold-error field-error" role="alert" hidden style="display:none">Thresholds must be in order: Moderate, High, then Very high.</small></section><section class="rule-section"><span class="eyebrow">NOTIFICATION CHANNELS</span>${channels.map((key)=>`<div class="rule-toggle"><span class="rule-channel-label"><b>${esc(channelLabels[key]||key)}</b>${key==="inApp"?"":'<small class="coming-later">Coming later</small>'}</span><button type="button" role="switch" aria-label="${esc(channelLabels[key]||key)}" aria-checked="${Boolean(rules.channels[key])}" class="toggle ${rules.channels[key]?"is-on":""}" data-channel="${esc(key)}" ${key==="inApp"?"":"disabled"}><span></span></button></div>`).join("")}<div class="rule-toggle"><b>Quiet hours</b><button type="button" role="switch" aria-label="Quiet hours" aria-checked="${Boolean(rules.quietHours)}" class="toggle ${rules.quietHours?"is-on":""}" data-quiet><span></span></button></div></section><section class="rule-section"><span class="eyebrow">RECIPIENT ROLES</span><div class="role-recipient-grid">${recipients.map((role)=>`<label class="checkbox-label"><input type="checkbox" name="recipients.${esc(role)}" data-recipient="${esc(role)}" ${rules.recipients[role]?"checked":""}>${esc(roleLabels[role]||role)}</label>`).join("")}</div></section>`;
  const thresholdError=content.querySelector(".threshold-error");
  const showThresholdError=(show)=>{thresholdError.hidden=!show;thresholdError.style.display=show?"block":"none";};
  showThresholdError(!(rules.moderateThreshold<rules.highThreshold&&rules.highThreshold<rules.veryHighThreshold));
  const footer=document.createElement("footer");footer.className="rules-actions modal-fixed-footer";
  footer.innerHTML='<button type="button" class="button button-secondary cancel-rules">Cancel</button><button type="button" class="button button-primary save-rules">Save rules</button>';
  const close=openOverlay({title:"Alert rules",content,footer});
  document.querySelector(".modal-panel")?.classList.add("alert-rules-modal");
  footer.querySelector(".cancel-rules").addEventListener("click",close);
  content.querySelectorAll("[data-rule]").forEach((input)=>input.addEventListener("input",()=>{const key=input.dataset.rule,raw=Number(input.value);const value=key==="moderateThreshold"?Math.min(raw,rules.highThreshold-1):key==="highThreshold"?Math.max(rules.moderateThreshold+1,Math.min(raw,rules.veryHighThreshold-1)):Math.max(rules.highThreshold+1,raw);rules[key]=value;input.value=String(value);input.parentElement.querySelector(".rule-value").textContent=String(value);const min=Number(input.min),max=Number(input.max);input.style.setProperty("--range-progress",`${((value-min)/(max-min))*100}%`);showThresholdError(!(rules.moderateThreshold<rules.highThreshold&&rules.highThreshold<rules.veryHighThreshold));}));
  content.querySelectorAll("[data-channel]").forEach((button)=>button.addEventListener("click",()=>{const next=button.getAttribute("aria-checked")!=="true";button.setAttribute("aria-checked",String(next));button.classList.toggle("is-on",next);rules.channels[button.dataset.channel]=next;}));
  content.querySelector("[data-quiet]").addEventListener("click",(event)=>{const button=event.currentTarget,next=button.getAttribute("aria-checked")!=="true";button.setAttribute("aria-checked",String(next));button.classList.toggle("is-on",next);rules.quietHours=next;});
  content.querySelectorAll("[data-recipient]").forEach((input)=>input.addEventListener("change",()=>{rules.recipients[input.dataset.recipient]=input.checked;}));
  footer.querySelector(".save-rules").addEventListener("click",async(event)=>{
    const saveButton=event.currentTarget;
    if(!(rules.moderateThreshold<rules.highThreshold&&rules.highThreshold<rules.veryHighThreshold)){
      showThresholdError(true);
      return;
    }
    showThresholdError(false);
    saveButton.disabled=true;
    try{await saveAlertRules(rules);onUpdate(rules);close();main.dispatchEvent(new CustomEvent("app:toast",{bubbles:true,detail:{message:"Alert rules saved.",type:"success"}}));}
    catch(error){saveButton.disabled=false;renderFieldErrors(content,error.details);main.dispatchEvent(new CustomEvent("app:toast",{bubbles:true,detail:{message:error.message||"Alert rules could not be saved.",type:"error"}}));}
  });
}
