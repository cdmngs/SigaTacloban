import { listUsers, addUser, updateUser, activateUser, deactivateUser, deleteUser, resetUserPassword, resendInvite, getRolePermissions } from "../api/users.js";
import { getRoleCodes, roleLabels, rolePermissions, setRolePermissionsFromApi } from "../core/permissions.js";
import { loadData, renderFieldErrors } from "../core/data-state.js";
import { setSharedData } from "../core/store.js";
import { formatDateTime, formatValue } from "../utils/format.js";
import { getSession, saveSession } from "../core/auth.js";
import { openOverlay } from "../ui/overlays.js";
import { escapeHtml } from "../utils/dom.js";
import { iconSvg } from "../ui/icons.js";

const styles=["phase4-pages.css","users.css"];
const capabilities=[
  ["dashboardMap","Dashboard & map"],["manageIncidents","Manage incidents"],["generateReports","Generate reports"],["modelEvaluation","Model evaluation"],
  ["userManagement","User management"],["runWhatIf","Run What-If"],["alertRules","Alert rules"],["stationPlanning","Station planning"],
];
const esc=escapeHtml;
function ensureStyles(){for(const file of styles){const id=`phase4-${file}`;if(document.getElementById(id))continue;const link=document.createElement("link");link.id=id;link.rel="stylesheet";link.href=`assets/css/${file}`;document.head.append(link);}}
function initials(name){const parts=String(name).trim().split(/\s+/).filter(Boolean);return parts.length>1?`${parts[0][0]}${parts[1][0]}`.toUpperCase():(parts[0]||"").slice(0,2).toUpperCase();}
function lastActiveLabel(value){return value==="Online"?"Online":formatDateTime(value);}

export async function mount(main,user){
  ensureStyles();
  let repaint=()=>{};
  const viewport=window.matchMedia("(max-width: 767px)");
  const onViewportChange=()=>repaint();
  viewport.addEventListener("change",onViewportChange);
  window.addEventListener("pagehide",()=>viewport.removeEventListener("change",onViewportChange),{once:true});
  const state=loadData(async(signal)=>{
    const [users,matrix]=await Promise.all([listUsers({signal}),getRolePermissions({signal})]);
    setRolePermissionsFromApi(matrix);
    setSharedData({rolePermissions:matrix});
    return {users,matrix};
  },[],{
    container:main,minHeight:420,errorTitle:"User directory could not be loaded.",
    success:(_container,result)=>{repaint=render(main,user,result.users,()=>state.load());},
    empty:(_container,_result,retry)=>renderLoadError(main,"No user data is available.",retry),
    error:(container,error,retry)=>renderLoadError(container,error.message||"User directory could not be loaded.",retry),
  });
  await state.load();
}
function renderLoadError(main,message,retry){
  main.innerHTML=`<div class="phase4-page"><div class="query-error" role="alert"><b>${esc(message)}</b><button class="button button-primary">Retry</button></div></div>`;
  main.querySelector("button").addEventListener("click",()=>{void retry();});
}
function render(main,currentUser,users,refresh){
  let search="",filter="all",page=1,menuId=null;const pageSize=10;
  const currentEmail=String(currentUser?.email??"").toLowerCase();
  const roles=getRoleCodes();
  const canManageUsers=Boolean(rolePermissions[currentUser?.role]?.capabilities?.userManagement);
  if(!canManageUsers){main.innerHTML='<div class="phase4-page forbidden-user-page"><div class="forbidden-user-card"><span class="eyebrow">ADMINISTRATION</span><h1>User management</h1><p>Your role does not have permission to manage users.</p><a class="button button-secondary" href="dashboard.html">Return to dashboard</a></div></div>';return ()=>{};}
  const filtered=()=>users.filter((item)=>`${item.name} ${item.email} ${item.role} ${item.stationUnit}`.toLowerCase().includes(search.toLowerCase())&&(filter==="all"||item.role===filter));
  const paint=()=>{
    const rows=filtered(),pageCount=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,pageCount);const visible=rows.slice((page-1)*pageSize,page*pageSize);
    const active=users.filter((item)=>item.active&&!item.pendingInvite).length;
    const pending=users.filter((item)=>item.pendingInvite).length;
    main.innerHTML=`<div class="phase4-page users-page"><header class="phase4-heading"><div><span class="eyebrow">ADMINISTRATION</span><h1>User management</h1><p>Manage access, roles and account status.</p></div><button class="button button-primary add-user">${iconSvg("plus",16)}Add user</button></header>
      <div class="user-stats">${[[active,"Active users","Ready for access","users","success"],[roles.length,"Roles","Configured access levels","shield","accent"],[pending,"Pending invites","Awaiting account setup","mail","info"]].map(([value,label,detail,icon,color])=>`<section class="card user-stat user-stat-${color}"><span class="user-stat-icon">${iconSvg(icon,22)}</span><div><small>${label}</small><strong>${value}</strong><span>${detail}</span></div></section>`).join("")}</div>
      <section class="card users-table-card"><header><div class="users-card-title"><h2>All users</h2><span class="account-count">${rows.length} ${rows.length===1?"account":"accounts"}</span></div><div class="user-controls"><label class="user-search">${iconSvg("search",16)}<span class="sr-only">Search users</span><input placeholder="Search users…" value="${esc(search)}"></label><label><span class="sr-only">Filter by role</span><select class="role-filter"><option value="all">All roles</option>${roles.map((role)=>`<option value="${role}" ${role===filter?"selected":""}>${esc(roleLabels[role]||role)}</option>`).join("")}</select></label></div></header>
      ${visible.length===0?'<div class="empty-state"><b>No users found</b><small>Try another search or clear the role filter.</small></div>':innerWidth<768?`<div class="user-mobile-list">${visible.map((item)=>mobileUser(item,currentEmail,menuId)).join("")}</div>`:`<div class="user-table-scroll"><table class="user-table"><thead><tr><th>User</th><th>Role</th><th>Station / unit</th><th>Last active</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${visible.map((item,index)=>tableUser(item,currentEmail,menuId,index>=visible.length-2)).join("")}</tbody></table></div>`}
       <footer class="user-pagination"><small>Showing ${rows.length?(page-1)*pageSize+1:0}-${Math.min(page*pageSize,rows.length)} of ${rows.length}</small><div><button aria-label="Previous page" ${page<=1?"disabled":""} data-page="${page-1}">${iconSvg("chevronLeft",16)}</button><span>Page ${page} of ${pageCount}</span><button aria-label="Next page" ${page>=pageCount?"disabled":""} data-page="${page+1}">${iconSvg("chevronRight",16)}</button></div></footer></section>
      <section class="card permissions-card"><header><div><span class="eyebrow">ACCESS CONTROL</span><h2>Roles &amp; permissions</h2><p>Read-only capability matrix enforced by the application.</p></div></header><div class="permissions-table-wrap"><table class="permissions-table"><thead><tr><th>Capability</th>${roles.map((role)=>`<th>${esc(roleLabels[role]||role)}</th>`).join("")}</tr></thead><tbody>${capabilities.map(([key,label])=>`<tr><th scope="row">${label}</th>${roles.map((role)=>rolePermissions[role]?.capabilities?.[key]?`<td><span class="permission-yes"><span class="sr-only">Allowed</span>${iconSvg("check",18)}</span></td>`:`<td><span class="permission-no"><span class="sr-only">Not allowed</span>${iconSvg("minus",14)}</span></td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="permissions-legend"><span><i class="legend-check">${iconSvg("check",14)}</i>Allowed</span><span><i class="legend-minus">${iconSvg("minus",12)}</i>Not allowed</span></p></section></div>`;
    main.querySelector(".add-user").addEventListener("click",()=>openUserForm(main,null,async(values)=>{await addUser(values);await refresh();}));
    main.querySelector(".user-search input").addEventListener("input",(event)=>{search=event.target.value;page=1;const position=search.length;paint();const input=main.querySelector(".user-search input");input.focus();input.setSelectionRange(position,position);});
    main.querySelector(".role-filter").addEventListener("change",(event)=>{filter=event.target.value;page=1;paint();});
    main.querySelectorAll("[data-page]").forEach((button)=>button.addEventListener("click",()=>{page=Math.max(1,Math.min(pageCount,Number(button.dataset.page)));paint();}));
    main.querySelectorAll("[data-menu]").forEach((button)=>button.addEventListener("click",()=>{menuId=menuId===button.dataset.menu?null:button.dataset.menu;paint();}));
    main.querySelectorAll("[data-action]").forEach((button)=>button.addEventListener("click",()=>{const item=users.find((candidate)=>candidate.id===button.closest("[data-user]").dataset.user);if(item)void runAction(main,item,button.dataset.action,currentEmail,()=>{menuId=null;},refresh);}));
    main.querySelectorAll("[data-edit]").forEach((button)=>button.addEventListener("click",()=>{const item=users.find((candidate)=>candidate.id===button.dataset.edit);if(item)openUserForm(main,item,async(values)=>{const updated=await updateUser(item.id,values);if(item.id===currentUser?.id){const session=getSession();currentUser={...currentUser,...updated};saveSession(currentUser,session.token,session.refreshToken);}await refresh();});}));
    main.querySelectorAll("[data-status]").forEach((button)=>button.addEventListener("click",()=>{const item=users.find((candidate)=>candidate.id===button.dataset.status);if(!item)return;if(item.email.toLowerCase()===currentEmail||item.id===currentUser?.id){toast(main,"You cannot deactivate or delete your own account.","error");return;}if(item.active)confirmUserAction(main,"Deactivate user?",`${item.name} will no longer be able to sign in.`,"Deactivate user",async()=>{await deactivateUser(item.id);await refresh();});else void activateUser(item.id).then(async()=>{await refresh();toast(main,`${item.name} is active again.`,"success");}).catch((error)=>toast(main,error.message||"User status could not be updated.","error"));}));
    main.querySelectorAll("[data-delete]").forEach((button)=>button.addEventListener("click",()=>{const item=users.find((candidate)=>candidate.id===button.dataset.delete);if(!item)return;if(item.email.toLowerCase()===currentEmail||item.id===currentUser?.id){toast(main,"You cannot delete your own account.","error");return;}confirmUserAction(main,"Delete user?",`${item.name} and their account details will be permanently removed.`,"Delete user",async()=>{await deleteUser(item.id);await refresh();});}));
  };
  paint();
  return paint;
}
function status(user){return user.pendingInvite?"Pending invite":user.active?"Active":"Inactive";}
function menu(user,currentEmail,id,opensUp=false){
  const own=user.email.toLowerCase()===currentEmail;
  return `<div class="user-row-menu${opensUp&&id===user.id?" opens-up":""}"><button type="button" aria-label="Row actions" aria-expanded="${id===user.id}" aria-haspopup="menu" title="Row actions" data-menu="${esc(user.id)}">${iconSvg("more",20)}</button>${id===user.id?`<div role="menu"><button role="menuitem" data-edit="${esc(user.id)}">${iconSvg("edit",16)} Edit</button><button role="menuitem" data-action="reset" data-user="${esc(user.id)}">${iconSvg("refresh",16)} Reset password</button><button role="menuitem" data-action="invite" data-user="${esc(user.id)}">${iconSvg("mail",16)} Resend invite</button><button role="menuitem" class="danger" data-delete="${esc(user.id)}" ${own?"disabled title=\"You cannot delete your own account.\"":""}>${iconSvg("trash",16)} Delete</button></div>`:""}</div>`;
}
function tableUser(user,currentEmail,id,opensUp){
  const own=user.email.toLowerCase()===currentEmail;
  return `<tr data-user="${esc(user.id)}"><td><div class="user-cell"><span class="user-avatar">${initials(user.name)}</span><div><b>${esc(formatValue(user.name))}</b><small>${esc(formatValue(user.email))}</small></div></div></td><td><span class="role-chip role-${esc(user.role)}">${esc(roleLabels[user.role]||user.role||"—")}</span></td><td>${esc(formatValue(user.stationUnit))}</td><td><span class="last-active${user.lastActive==="Online"?" is-online":""}">${esc(lastActiveLabel(user.lastActive))}</span></td><td><button class="status-toggle ${user.active&&!user.pendingInvite?"active":""}" role="switch" aria-checked="${user.active&&!user.pendingInvite}" data-status="${esc(user.id)}" ${user.pendingInvite||own?`disabled title="${own?"Your account status cannot be changed.":"Pending invitations cannot be toggled."}"`:""}><i></i>${status(user)}</button></td><td>${menu(user,currentEmail,id,opensUp)}</td></tr>`;
}
function mobileUser(user,currentEmail,id){
  const own=user.email.toLowerCase()===currentEmail;
  return `<article class="user-mobile-row" data-user="${esc(user.id)}"><div class="user-mobile-primary"><span class="user-avatar">${initials(user.name)}</span><div><b>${esc(formatValue(user.name))}</b><small>${esc(formatValue(user.email))}</small></div>${menu(user,currentEmail,id,id===user.id)}</div><span class="role-chip role-${esc(user.role)}">${esc(roleLabels[user.role]||user.role||"—")}</span><small class="user-unit">${esc(formatValue(user.stationUnit))}</small><div class="user-mobile-meta"><span class="last-active${user.lastActive==="Online"?" is-online":""}">${esc(lastActiveLabel(user.lastActive))}</span><button class="status-toggle ${user.active&&!user.pendingInvite?"active":""}" role="switch" aria-checked="${user.active&&!user.pendingInvite}" data-status="${esc(user.id)}" ${user.pendingInvite||own?`disabled title="${own?"Your account status cannot be changed.":"Pending invitations cannot be toggled."}"`:""}><i></i>${status(user)}</button></div></article>`;
}
function toast(main,message,type="success"){main.dispatchEvent(new CustomEvent("app:toast",{bubbles:true,detail:{message,type}}));}
async function runAction(main,user,action,currentEmail,done,refresh){done();try{if(action==="reset")await resetUserPassword(user.id);else await resendInvite(user.id);await refresh();toast(main,action==="reset"?"Password reset request sent.":"Invitation resent.");}catch(error){toast(main,error.message||"User action could not be completed.","error");}}
function confirmUserAction(main,title,message,label,action){
  const content=document.createElement("p");content.textContent=message;
  openOverlay({kind:"confirm",title,message,content,confirmLabel:label,onConfirm:async()=>{try{await action();toast(main,title.startsWith("Delete")?"User was deleted.":"User was deactivated.");}catch(error){toast(main,error.message||"User change could not be completed.","error");}}});
}
function openUserForm(main,user,save){
  const form=document.createElement("form");form.className="user-form";form.noValidate=true;form.id=`user-form-${Date.now()}`;
  const roles=getRoleCodes();
  form.innerHTML=`<label>Full name<input name="name" placeholder="Full name" value="${esc(user?.name??"")}" aria-describedby="user-name-error" required minlength="2"><small class="field-error" id="user-name-error" hidden>Enter a name with at least two characters.</small></label><label>Official email<input name="email" type="email" placeholder="name@bfp.gov.ph" value="${esc(user?.email??"")}" ${user?"disabled":""} aria-describedby="user-email-error" required><small class="field-error" id="user-email-error" hidden>Use an @bfp.gov.ph email address.</small></label><label>Role<select name="role">${roles.map((role)=>`<option value="${role}" ${(user?.role??"prevention")===role?"selected":""}>${esc(roleLabels[role]||role)}</option>`).join("")}</select></label><label>Station / unit<input name="stationUnit" placeholder="Station or unit" value="${esc(user?.stationUnit??"")}" aria-describedby="user-unit-error" required minlength="2"><small class="field-error" id="user-unit-error" hidden>Enter a station or unit with at least two characters.</small></label><label class="user-active-field"><input name="active" type="checkbox" ${user?.active!==false?"checked":""}><span><b>Account active</b><small>Inactive accounts cannot sign in.</small></span></label>`;
  const footer=document.createElement("footer");footer.className="modal-fixed-footer user-form-actions";
  footer.innerHTML=`<button class="button button-secondary overlay-cancel" type="button">Cancel</button><button class="button button-primary" type="submit" form="${form.id}">${user?"Save changes":"Add user"}</button>`;
  const close=openOverlay({title:user?"Edit user":"Add user",subtitle:user?"Update account details and access.":"Create an account for an authorized BFP user.",content:form,footer,initialFocus:'input[name="name"]'});document.querySelector(".modal-panel")?.classList.add("user-form-modal");
  form.addEventListener("submit",async(event)=>{event.preventDefault();const values=Object.fromEntries(new FormData(form));const email=String(values.email??user?.email??"").trim().toLowerCase();const official=form.elements.email;
    const nameField=form.elements.name,unitField=form.elements.stationUnit;
    const nameInvalid=nameField.value.trim().length<2,unitInvalid=unitField.value.trim().length<2,emailInvalid=!/^[^\s@]+@bfp\.gov\.ph$/i.test(email);
    form.querySelector("#user-name-error").hidden=!nameInvalid;form.querySelector("#user-unit-error").hidden=!unitInvalid;form.querySelector("#user-email-error").hidden=!emailInvalid;
    nameField.setAttribute("aria-invalid",String(nameInvalid));unitField.setAttribute("aria-invalid",String(unitInvalid));official.setAttribute("aria-invalid",String(emailInvalid));
    if(nameInvalid||unitInvalid||emailInvalid){(nameInvalid?nameField:emailInvalid?official:unitField).focus();return;}
    const submit=footer.querySelector('[type="submit"]');submit.disabled=true;submit.textContent=user?"Saving…":"Adding…";try{await save({name:String(values.name).trim(),email,role:String(values.role),stationUnit:String(values.stationUnit).trim(),active:form.elements.active.checked});toast(main,user?"User details updated.":"User added and invite sent.");close();}catch(error){submit.disabled=false;submit.textContent=user?"Save changes":"Add user";renderFieldErrors(form,error.details);toast(main,error.message||"User changes could not be saved.","error");}
  });
}
