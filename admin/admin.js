const $=id=>document.getElementById(id);
const LOCAL_ADMIN_HOST = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const API_BASE_URL=String(window.ADMIN_API_BASE_URL||(LOCAL_ADMIN_HOST?window.location.origin:"https://api.postlyfi.in")).replace(/\/$/,"");
let csrfToken="";
let firebaseAuth=null;
let firebaseInitPromise=null;

async function initFirebaseAuth(){
  if(firebaseInitPromise)return firebaseInitPromise;
  firebaseInitPromise=(async()=>{
    if(!window.firebase?.auth)return null;
    try{
      const response=await fetch("/__/firebase/init.json",{cache:"no-store"});
      if(!response.ok)throw new Error("Firebase configuration unavailable");
      const config=await response.json();
      if(!firebase.apps.length)firebase.initializeApp(config);
      firebaseAuth=firebase.auth();
      await firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.NONE);
      return firebaseAuth;
    }catch(error){
      console.warn("[admin] Firebase Authentication unavailable; legacy login remains available.",error);
      firebaseAuth=null;
      return null;
    }
  })();
  return firebaseInitPromise;
}

if (!LOCAL_ADMIN_HOST) void initFirebaseAuth();
let projects=[];
let certificates=[];
let sessionTimerHandle=null;
let sessionExpiresAtMs=0;

function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function fmtDate(value){try{return new Date(value).toLocaleString()}catch(_){return String(value||"")}}
async function api(path,options={}){
  const headers={"Accept":"application/json"};
  if(options.body)headers["Content-Type"]=options.contentType||"application/json";
  if(options.csrf)headers["X-CSRF-Token"]=csrfToken;
  const controller=new AbortController();
  const timeoutId=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(API_BASE_URL+path,{...options,headers,credentials:"include",signal:controller.signal});
    let data=null;try{data=await response.json()}catch(_){}
    if(response.status===401 && path !== "/api/admin/login"){showLogin();throw new Error("Authentication required.")}
    if(response.status===429){
      const error=new Error(data&&data.error?data.error:"Too many requests. Please retry later.");
      error.status=429;
      error.retryAfter=Number(response.headers.get("retry-after")||data?.retryAfter||0);
      throw error;
    }
    if(!response.ok)throw new Error(data&&data.error?data.error:"Request failed ("+response.status+")");
    return data;
  }catch(error){
    if(error?.name==="AbortError"){
      const timeoutError=new Error("Request timed out. Check that the Docker app and MySQL database are running.");
      timeoutError.status=408;
      throw timeoutError;
    }
    throw error;
  }finally{
    clearTimeout(timeoutId);
  }
}
function showLogin(message=""){clearSessionTimer();$("appView").hidden=true;$("loginView").hidden=false;csrfToken="";if(message){$("loginStatus").textContent=message;$("loginStatus").className="status status-info"}}
function showApp(user){
  $("loginView").hidden=true;
  $("appView").hidden=false;
  const email=(user&&user.email)||"Admin";
  $("currentUser").textContent=email;
  $("sidebarUser").textContent=email;
}
async function loadSession(){try{const d=await api("/api/admin/session");if(d.authenticated){csrfToken=d.csrfToken;showApp(d.user);startSessionTimer(d.expiresAt);await Promise.allSettled([loadMessages(),loadProjects(),loadCertificates(),loadAnalytics()]);return true}}catch(_){}showLogin();return false}

async function loadAccount(){try{const d=await api("/api/admin/account");const account=d.data||{};$("accountEmail").value=account.email||"";$("accountStatus").textContent=""}catch(err){$("accountStatus").textContent=err.message}}

function formatSessionTime(ms){
  const total=Math.max(0,Math.ceil(ms/1000));
  const hours=Math.floor(total/3600);
  const minutes=Math.floor((total%3600)/60);
  const seconds=total%60;
  if(hours>0)return hours+"h "+String(minutes).padStart(2,"0")+"m";
  return minutes+"m "+String(seconds).padStart(2,"0")+"s";
}

function clearSessionTimer(){
  if(sessionTimerHandle)clearInterval(sessionTimerHandle);
  sessionTimerHandle=null;
  sessionExpiresAtMs=0;
  const status=$("sessionStatus");
  if(status)status.classList.remove("session-warning");
}

async function expireSession(){
  clearSessionTimer();
  try{await fetch(API_BASE_URL+"/api/admin/logout",{method:"POST",credentials:"include"});}catch(_){}
  showLogin("Your admin session has expired. Please sign in again.");
}

function startSessionTimer(expiresAt){
  clearSessionTimer();
  const expiry=typeof expiresAt==="number" ? expiresAt : new Date(expiresAt).getTime();
  if(!Number.isFinite(expiry)||expiry<=Date.now())return expireSession();
  sessionExpiresAtMs=expiry;
  const tick=()=>{
    const remaining=sessionExpiresAtMs-Date.now();
    const timer=$("sessionTimer");
    const status=$("sessionStatus");
    if(!timer||!status)return;
    if(remaining<=0)return expireSession();
    timer.textContent="Session "+formatSessionTime(remaining);
    status.classList.toggle("session-warning",remaining<=5*60*1000);
  };
  tick();
  sessionTimerHandle=setInterval(tick,1000);
}

let loginCooldownTimer=null;
function formatCooldown(seconds){
  const total=Math.max(0,Number(seconds)||0);
  const minutes=Math.floor(total/60);
  const secs=total%60;
  return minutes>0 ? (minutes+"m "+String(secs).padStart(2,"0")+"s") : (secs+"s");
}
function startLoginCooldown(seconds){
  clearInterval(loginCooldownTimer);
  let remaining=Math.max(1,Number(seconds)||1);
  const button=document.querySelector('#loginForm button[type="submit"]');
  button.disabled=true;
  const tick=()=>{
    if(remaining<=0){
      clearInterval(loginCooldownTimer);
      button.disabled=false;
      $("loginStatus").textContent="You can try signing in again.";
      return;
    }
    $("loginStatus").textContent="Too many login attempts. Try again in "+formatCooldown(remaining)+".";
    remaining-=1;
  };
  tick();
  loginCooldownTimer=setInterval(tick,1000);
}
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  clearInterval(loginCooldownTimer);
  $("loginStatus").textContent="Signing in…";
  $("loginStatus").className="status status-info";
  const button=document.querySelector('#loginForm button[type="submit"]');
  button.disabled=true;
  try{
    const email=$("loginEmail").value.trim();
    const password=$("loginPassword").value;
    let d;

    const auth=LOCAL_ADMIN_HOST ? null : await initFirebaseAuth();
    if(auth){
      $("loginStatus").textContent="Authenticating with Firebase…";
      try{
        const credential=await auth.signInWithEmailAndPassword(email,password);
        const firebaseIdToken=await credential.user.getIdToken(true);
        d=await api("/api/admin/login",{
          method:"POST",
          body:new URLSearchParams({firebaseIdToken}).toString(),
          contentType:"application/x-www-form-urlencoded;charset=UTF-8"
        });
        await auth.signOut();
      }catch(firebaseError){
        try{await auth.signOut()}catch(_){}
        const code=firebaseError?.code||"";
        if(code==="auth/invalid-credential"||code==="auth/wrong-password"||code==="auth/user-not-found"||code==="auth/invalid-email"){
          throw new Error("Invalid email or password.");
        }
        throw firebaseError;
      }
    }else{
      d=await api("/api/admin/login",{
        method:"POST",
        body:JSON.stringify({email,password})
      });
    }

    if(!d || !d.authenticated || !d.csrfToken) throw new Error("Admin authentication failed. Please try again.");
    csrfToken=d.csrfToken||"";
    showApp(d.user);
    startSessionTimer(Date.now()+Number(d.expiresIn||0)*1000);
    $("loginPassword").value="";
    $("loginStatus").textContent="";
    $("loginStatus").className="status";
    await Promise.allSettled([loadMessages(),loadProjects(),loadCertificates(),loadAnalytics()]);
  }catch(err){
    if(err.status===429){
      startLoginCooldown(err.retryAfter);
    }else{
      button.disabled=false;
      $("loginStatus").textContent=err.message;
      $("loginStatus").className="status status-error";
    }
  }
});
$("logoutBtn").addEventListener("click",async()=>{try{await api("/api/admin/logout",{method:"POST"})}finally{showLogin()}});

const TAB_META={
  messages:["Messages","Review and manage incoming messages."],
  projects:["Projects","Create, edit and publish portfolio projects."],
  certificates:["Certificates","Manage your published and draft credentials."],
  analytics:["Analytics","Understand portfolio activity and engagement."],
  account:["Account","Update administrator credentials and security."]
};
document.querySelectorAll(".tabs button").forEach(btn=>btn.addEventListener("click",async()=>{
  document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("active",x===btn));
  document.querySelectorAll(".tab-panel").forEach(x=>x.hidden=true);
  $(btn.dataset.tab+"Tab").hidden=false;
  const meta=TAB_META[btn.dataset.tab]||["Admin Console","Manage your portfolio workspace."];
  $("pageTitle").textContent=meta[0];
  $("headingSummary").textContent=meta[1];
  const dashboard=$("appView");
  if(dashboard.classList.contains("nav-open"))closeMobileNav();
  try{
    if(btn.dataset.tab==="messages")await loadMessages();
    if(btn.dataset.tab==="projects")await loadProjects();
    if(btn.dataset.tab==="certificates")await loadCertificates();
    if(btn.dataset.tab==="analytics")await loadAnalytics();
    if(btn.dataset.tab==="account")await loadAccount();
  }catch(err){console.error(err)}
}));

async function loadMessages(){try{const d=await api("/api/admin/messages");const rows=d.data||[];$("messagesCount").textContent=rows.length;$("navMessagesCount").textContent=rows.length;$("messagesList").innerHTML=rows.length?rows.map(m=>'<article class="message-card '+(m.status==="new"?"unread":"")+'"><h3>'+esc(m.name)+' <span class="meta">('+esc(m.email)+')</span></h3><div class="meta">'+esc(m.subject||"No subject")+' · '+esc(fmtDate(m.created_at))+' · '+esc(m.status)+'</div><div class="message-text">'+esc(m.message)+'</div><div class="card-actions">'+(m.status!=="read"?'<button class="ghost" onclick="updateMessage(\''+esc(m.id)+'\',\'read\')">Mark read</button>':"")+(m.status!=="archived"?'<button class="ghost" onclick="updateMessage(\''+esc(m.id)+'\',\'archived\')">Archive</button>':"")+(m.status!=="new"?'<button class="ghost" onclick="updateMessage(\''+esc(m.id)+'\',\'new\')">Mark new</button>':"")+'</div></article>').join(""):'<div class="empty">No messages yet.</div>'}catch(err){$("messagesList").innerHTML='<div class="empty">'+esc(err.message)+'</div>'}}
window.updateMessage=async(id,status)=>{try{await api("/api/admin/messages/"+encodeURIComponent(id),{method:"PATCH",csrf:true,body:JSON.stringify({status:status})});await loadMessages()}catch(err){alert(err.message)}};
$("refreshMessages").addEventListener("click",loadMessages);

function resetProjectForm(){$("projectForm").reset();$("projectId").value="";$("projectOriginalSlug").value="";$("projectPublished").checked=true;$("projectOrder").value="0";$("projectFormWrap").hidden=true;$("projectStatus").textContent=""}
$("newProjectBtn").addEventListener("click",()=>{$("projectForm").reset();$("projectId").value="";$("projectOriginalSlug").value="";$("projectPublished").checked=true;$("projectOrder").value="0";$("projectFormWrap").hidden=false});
$("cancelProjectBtn").addEventListener("click",resetProjectForm);
async function loadProjects(){try{const d=await api("/api/projects?admin=1");projects=d.data||[];$("projectsCount").textContent=projects.length;$("navProjectsCount").textContent=projects.length;$("projectsList").innerHTML=projects.length?projects.map(p=>'<article class="card"><h3>'+esc(p.title)+'</h3><div class="meta">/'+esc(p.slug)+' · '+(p.published?"Published":"Draft")+' · order '+esc(p.display_order)+'</div><p>'+esc(p.summary)+'</p><div class="meta">'+esc((p.tech_stack||[]).join(" · "))+'</div><div class="card-actions"><button class="ghost" onclick="editProject(\''+esc(p.id)+'\')">Edit</button><button class="ghost" onclick="deleteProject(\''+esc(p.slug)+'\')">Delete</button></div></article>').join(""):'<div class="empty">No projects in the database yet. Create your first project above.</div>'}catch(err){$("projectsList").innerHTML='<div class="empty">'+esc(err.message)+'</div>'}}
window.editProject=id=>{const p=projects.find(x=>x.id===id);if(!p)return;$("projectId").value=p.id;$("projectOriginalSlug").value=p.slug||"";$("projectTitle").value=p.title||"";$("projectSlug").value=p.slug||"";$("projectSummary").value=p.summary||"";$("projectDescription").value=p.description||"";$("projectTech").value=(p.tech_stack||[]).join(", ");$("projectRepo").value=p.repository_url||"";$("projectDemo").value=p.demo_url||"";$("projectImage").value=p.image_url||"";$("projectOrder").value=p.display_order??0;$("projectFeatured").checked=!!p.featured;$("projectPublished").checked=!!p.published;$("projectFormWrap").hidden=false;scrollTo({top:0,behavior:"smooth"})};
$("projectForm").addEventListener("submit",async e=>{e.preventDefault();$("projectStatus").textContent="Saving…";const id=$("projectId").value;const payload={title:$("projectTitle").value,slug:$("projectSlug").value,summary:$("projectSummary").value,description:$("projectDescription").value,techStack:$("projectTech").value.split(",").map(x=>x.trim()).filter(Boolean),repositoryUrl:$("projectRepo").value,demoUrl:$("projectDemo").value,imageUrl:$("projectImage").value,displayOrder:Number($("projectOrder").value),featured:$("projectFeatured").checked,published:$("projectPublished").checked};try{await api(id?"/api/projects/"+encodeURIComponent($("projectOriginalSlug").value||$("projectSlug").value):"/api/projects",{method:id?"PATCH":"POST",csrf:true,body:JSON.stringify(payload)});$("projectStatus").textContent="Saved.";await loadProjects();setTimeout(resetProjectForm,300)}catch(err){$("projectStatus").textContent=err.message}});
window.deleteProject=async slug=>{if(!confirm("Delete this project?"))return;try{await api("/api/projects/"+encodeURIComponent(slug),{method:"DELETE",csrf:true});await loadProjects()}catch(err){alert(err.message)}};

function resetCertificateForm(){$("certificateForm").reset();$("certificateId").value="";$("certificatePublished").checked=true;$("certificateOrder").value="0";$("certificateFormWrap").hidden=true;$("certificateStatus").textContent=""}
$("newCertificateBtn").addEventListener("click",()=>{$("certificateForm").reset();$("certificateId").value="";$("certificatePublished").checked=true;$("certificateOrder").value="0";$("certificateFormWrap").hidden=false});
$("cancelCertificateBtn").addEventListener("click",resetCertificateForm);
async function loadCertificates(){try{const d=await api("/api/certificates?admin=1");certificates=d.data||[];$("certificatesCount").textContent=certificates.length;$("navCertificatesCount").textContent=certificates.length;$("certificatesList").innerHTML=certificates.length?certificates.map(c=>'<article class="card"><h3>'+esc(c.title)+'</h3><div class="meta">'+esc(c.issuer||"")+' · '+(c.published?"Published":"Draft")+' · order '+esc(c.display_order)+'</div><p>'+esc(c.description||"")+'</p><div class="card-actions"><button class="ghost" onclick="editCertificate(\''+esc(c.id)+'\')">Edit</button><button class="ghost" onclick="deleteCertificate(\''+esc(c.id)+'\')">Delete</button></div></article>').join(""):'<div class="empty">No certificates in the database yet.</div>'}catch(err){$("certificatesList").innerHTML='<div class="empty">'+esc(err.message)+'</div>'}}
window.editCertificate=id=>{const c=certificates.find(x=>x.id===id);if(!c)return;$("certificateId").value=c.id;$("certificateTitle").value=c.title||"";$("certificateIssuer").value=c.issuer||"";$("certificateIssuedOn").value=c.issued_on||"";$("certificateCredential").value=c.credential_url||"";$("certificateImage").value=c.image_url||"";$("certificateDescription").value=c.description||"";$("certificateOrder").value=c.display_order??0;$("certificatePublished").checked=!!c.published;$("certificateFormWrap").hidden=false;scrollTo({top:0,behavior:"smooth"})};
$("certificateForm").addEventListener("submit",async e=>{e.preventDefault();$("certificateStatus").textContent="Saving…";const id=$("certificateId").value;const payload={title:$("certificateTitle").value,issuer:$("certificateIssuer").value,issuedOn:$("certificateIssuedOn").value||null,credentialUrl:$("certificateCredential").value,imageUrl:$("certificateImage").value,description:$("certificateDescription").value,displayOrder:Number($("certificateOrder").value),published:$("certificatePublished").checked};try{await api("/api/certificates"+(id?"/"+encodeURIComponent(id):""),{method:id?"PATCH":"POST",csrf:true,body:JSON.stringify(payload)});$("certificateStatus").textContent="Saved.";await loadCertificates();setTimeout(resetCertificateForm,300)}catch(err){$("certificateStatus").textContent=err.message}});
window.deleteCertificate=async id=>{if(!confirm("Delete this certificate?"))return;try{await api("/api/certificates/"+encodeURIComponent(id),{method:"DELETE",csrf:true});await loadCertificates()}catch(err){alert(err.message)}};

async function loadAnalytics(){try{const d=await api("/api/admin/analytics?days="+encodeURIComponent($("analyticsDays").value));const t=d.totals||{};$("eventsCount").textContent=t.events||0;$("analyticsSummary").innerHTML=[["Events",t.events||0],["Visits",t.visits||0],["Contact starts",t.contactStarts||0],["Contact submits",t.contactSubmits||0],["Game starts",t.gameStarts||0],["Game completes",t.gameCompletes||0]].map(x=>'<div class="metric"><span class="meta">'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join("");$("analyticsEvents").textContent=JSON.stringify(d.byEvent||{},null,2);$("analyticsSections").textContent=JSON.stringify(d.bySection||{},null,2);$("analyticsProjects").textContent=JSON.stringify(d.byProject||{},null,2);$("analyticsDaysData").textContent=JSON.stringify(d.byDay||{},null,2)}catch(err){$("analyticsSummary").innerHTML='<div class="empty">'+esc(err.message)+'</div>'}}
$("refreshAnalytics").addEventListener("click",loadAnalytics);
$("analyticsDays").addEventListener("change",loadAnalytics);
loadSession();

$("accountForm").addEventListener("submit",async e=>{
  e.preventDefault();
  $("accountStatus").textContent="Updating account…";
  const newPassword=$("newPassword").value;
  const confirmPassword=$("confirmPassword").value;
  if(newPassword && newPassword!==confirmPassword){
    $("accountStatus").textContent="New passwords do not match.";
    return;
  }
  try{
    const d=await api("/api/admin/account",{method:"PATCH",csrf:true,body:JSON.stringify({
      email:$("accountEmail").value,
      currentPassword:$("currentPassword").value,
      newPassword:newPassword
    })});
    if(d.csrfToken)csrfToken=d.csrfToken;
    if(d.data)showApp(d.data);
    if(d.expiresIn)startSessionTimer(Date.now()+Number(d.expiresIn)*1000);
    $("currentPassword").value="";
    $("newPassword").value="";
    $("confirmPassword").value="";
    $("accountStatus").textContent="Account updated successfully.";
  }catch(err){
    $("accountStatus").textContent=err.message;
  }
});

function closeMobileNav(){
  const dashboard=$("appView");
  dashboard.classList.remove("nav-open");
  const toggle=$("mobileNavToggle");
  if(toggle)toggle.setAttribute("aria-expanded","false");
  const backdrop=$("sidebarBackdrop");
  if(backdrop)backdrop.hidden=true;
}
function openMobileNav(){
  const dashboard=$("appView");
  dashboard.classList.add("nav-open");
  const toggle=$("mobileNavToggle");
  if(toggle)toggle.setAttribute("aria-expanded","true");
  const backdrop=$("sidebarBackdrop");
  if(backdrop)backdrop.hidden=false;
}
$("mobileNavToggle").addEventListener("click",()=>{
  $("appView").classList.contains("nav-open")?closeMobileNav():openMobileNav();
});
$("sidebarBackdrop").addEventListener("click",closeMobileNav);

$("loginPasswordToggle").addEventListener("click",()=>{
  const input=$("loginPassword");
  const button=$("loginPasswordToggle");
  const visible=input.type==="text";
  input.type=visible?"password":"text";
  button.setAttribute("aria-pressed",String(!visible));
  button.setAttribute("aria-label",visible?"Show password":"Hide password");
});
