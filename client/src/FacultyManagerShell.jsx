import { useCallback, useEffect, useState } from "react";

const nav = [
  ["overview","Vue d’ensemble","⌂"],
  ["programs","Programmes et niveaux","▤"],
  ["managers","Responsables de programme","♙"],
  ["professors","Professeurs","▧"],
  ["documents","Documents pédagogiques","▣"]
];

const css = `
.faculty-app{min-height:100vh;background:#f5f6f8;color:#171717;font-family:inherit}
.faculty-top{height:68px;background:#fff;border-bottom:1px solid #e7e7e7;display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:5}
.faculty-brand{display:flex;align-items:center;gap:10px;font-weight:800;color:#171717;text-decoration:none}.faculty-brand img{width:34px;height:34px;object-fit:contain}.faculty-brand span span{font-weight:400;color:#a16207}
.faculty-user{font-size:13px;color:#555;background:#f5f5f5;border-radius:30px;padding:9px 13px}
.faculty-layout{display:grid;grid-template-columns:255px minmax(0,1fr);min-height:calc(100vh - 68px)}
.faculty-side{background:#fff;border-right:1px solid #e7e7e7;padding:25px 15px;display:flex;flex-direction:column;gap:7px}
.faculty-nav-title{font-size:10px;font-weight:800;letter-spacing:.13em;color:#999;padding:0 12px 12px}
.faculty-nav{border:0;background:transparent;text-align:left;padding:12px;border-radius:10px;display:flex;align-items:center;gap:11px;color:#555;font:inherit;font-size:14px;cursor:pointer}
.faculty-nav:hover{background:#f8f4e9;color:#171717}.faculty-nav.active{background:#fff4d6;color:#805400;font-weight:700}
.faculty-nav-icon{width:25px;height:25px;display:grid;place-items:center;border-radius:7px;background:#f3f3f3;font-weight:700}.faculty-nav.active .faculty-nav-icon{background:#f6df9f}
.faculty-side-note{margin-top:auto;padding:14px 12px;color:#999;font-size:11px;border-top:1px solid #eee}
.faculty-main{padding:34px;max-width:1220px;width:100%;margin:0 auto}
.faculty-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:25px}
.faculty-eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;color:#9a6b12;margin:0 0 8px}
.faculty-heading h1{font-size:28px;line-height:1.2;margin:0 0 8px}.faculty-heading p{color:#777;margin:0;font-size:14px}
.faculty-badge{font-size:11px;font-weight:800;letter-spacing:.08em;color:#805400;background:#fff0c7;border-radius:20px;padding:9px 13px}
.faculty-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:20px}
.faculty-card{background:#fff;border:1px solid #e9e9e9;border-radius:14px;padding:20px;box-shadow:0 2px 8px #00000005;margin-bottom:16px}
.faculty-stat-label{font-size:12px;color:#777}.faculty-stat-value{font-size:28px;font-weight:800;margin-top:8px}
.faculty-card h2{font-size:16px;margin:0 0 14px}.faculty-card p{font-size:13px;line-height:1.6;color:#666}
.faculty-list{display:flex;flex-direction:column;gap:10px}
.faculty-item{border:1px solid #eee;border-radius:11px;padding:14px;display:flex;justify-content:space-between;gap:15px;align-items:center}
.faculty-item strong{font-size:14px}.faculty-muted{font-size:12px;color:#888;margin-top:4px}
.faculty-pill{display:inline-flex;background:#f4f4f4;border-radius:20px;padding:5px 9px;font-size:11px;color:#666;white-space:nowrap}
.faculty-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
.faculty-field{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:#555}
.faculty-field.full{grid-column:1/-1}
.faculty-field input,.faculty-field select{width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:9px;padding:11px 12px;background:#fff;color:#222;font:inherit;font-size:13px}
.faculty-button{border:0;border-radius:9px;padding:11px 15px;background:#e9a900;color:#171717;font:inherit;font-size:13px;font-weight:800;cursor:pointer}
.faculty-button:disabled{opacity:.55;cursor:not-allowed}.faculty-button.secondary{background:#f0f0f0;color:#444}
.faculty-feedback{padding:11px 13px;border-radius:9px;background:#fff5d9;color:#775000;font-size:13px;margin:0 0 16px}
.faculty-empty{padding:24px;text-align:center;color:#888;border:1px dashed #ddd;border-radius:12px;font-size:13px}
.faculty-scope{padding:14px 16px;border:1px solid #f0dfb5;background:#fffaf0;border-radius:11px;color:#775000;font-size:12px;margin-bottom:18px}
.faculty-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
@media(max-width:900px){.faculty-layout{grid-template-columns:1fr}.faculty-side{position:sticky;top:68px;z-index:4;flex-direction:row;overflow-x:auto;padding:9px;border-right:0;border-bottom:1px solid #e7e7e7}.faculty-nav-title,.faculty-side-note{display:none}.faculty-nav{white-space:nowrap;padding:9px 11px;font-size:12px}.faculty-main{padding:22px 16px}.faculty-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.faculty-top{padding:0 14px;height:60px}.faculty-layout{min-height:calc(100vh - 60px)}.faculty-side{top:60px}.faculty-user{display:none}.faculty-heading h1{font-size:23px}.faculty-grid{gap:9px}.faculty-card{padding:14px}.faculty-stat-value{font-size:23px}.faculty-form{grid-template-columns:1fr}.faculty-field.full{grid-column:auto}.faculty-item{align-items:flex-start;flex-direction:column}}
`;

export default function FacultyManagerShell({token,user,onLogout,request}) {
  const [active,setActive]=useState("overview");
  const [overview,setOverview]=useState({});
  const [scopes,setScopes]=useState([]);
  const [programs,setPrograms]=useState([]);
  const [levels,setLevels]=useState([]);
  const [managers,setManagers]=useState([]);
  const [professors,setProfessors]=useState([]);
  const [documents,setDocuments]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState("");
  const [downloadingId,setDownloadingId]=useState(null);
  const [form,setForm]=useState({email:"",optionId:"",studyLevelId:""});

  const load=useCallback(async()=>{
    setLoading(true);
    const results=await Promise.allSettled([
      request("/faculty-manager/overview",{token}),
      request("/faculty-manager/programs",{token}),
      request("/faculty-manager/program-managers",{token}),
      request("/faculty-manager/professors",{token}),
      request("/faculty-manager/documents",{token})
    ]);
    if(results[0].status==="fulfilled"){setOverview(results[0].value.data||{});setScopes(results[0].value.scopes||[]);}
    if(results[1].status==="fulfilled"){setPrograms(results[1].value.data?.programs||[]);setLevels(results[1].value.data?.levels||[]);}
    if(results[2].status==="fulfilled")setManagers(results[2].value.data||[]);
    if(results[3].status==="fulfilled")setProfessors(results[3].value.data||[]);
    if(results[4].status==="fulfilled")setDocuments(results[4].value.data||[]);
    const failed=results.find(x=>x.status==="rejected");
    if(failed)setFeedback(failed.reason?.message||"Certaines informations n’ont pas pu être chargées.");
    setLoading(false);
  },[request,token]);

  useEffect(()=>{load();},[load]);

  const visibleLevels=levels.filter(level=>String(level.option_id)===String(form.optionId));
  const page={
    overview:["Vue d’ensemble","Supervisez les activités académiques de votre faculté."],
    programs:["Programmes et niveaux","Consultez les options, les niveaux, les matières et les cours de votre faculté."],
    managers:["Responsables de programme","Nommez les responsables et gérez leurs accès par programme."],
    professors:["Professeurs","Consultez les professeurs affectés aux programmes de votre faculté."],
    documents:["Documents pédagogiques","Consultez les ressources pédagogiques publiées dans votre faculté."]
  }[active];

  async function downloadDocument(doc){
    setDownloadingId(doc.id);setFeedback("");
    try{
      const response=await fetch(`/api/v1/faculty-manager/documents/${doc.id}/download`,{headers:{Authorization:`Bearer ${token}`}});
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message||"Téléchargement impossible pour ce document.");}
      const blob=await response.blob(),url=URL.createObjectURL(blob),anchor=document.createElement("a");
      anchor.href=url;anchor.download=doc.file_name||`document-ifac-${doc.id}`;
      document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
    }catch(error){setFeedback(error.message);}
    finally{setDownloadingId(null);}
  }

  async function appoint(event){
    event.preventDefault();setBusy(true);setFeedback("");
    try{
      const result=await request("/faculty-manager/program-managers",{token,method:"POST",body:JSON.stringify({
        email:form.email,optionId:Number(form.optionId),studyLevelId:form.studyLevelId?Number(form.studyLevelId):null
      })});
      setForm({email:"",optionId:"",studyLevelId:""});
      setFeedback(result.message||"Responsable nommé.");
      await load();
    }catch(error){setFeedback(error.message);}
    finally{setBusy(false);}
  }

  async function changeStatus(assignment,activeStatus){
    setBusy(true);setFeedback("");
    try{
      const result=await request(`/faculty-manager/program-managers/${assignment.assignment_id}/status`,{
        token,method:"PATCH",body:JSON.stringify({active:activeStatus})
      });
      setFeedback(result.message||"Nomination mise à jour.");
      await load();
    }catch(error){setFeedback(error.message);}
    finally{setBusy(false);}
  }

  return <main className="faculty-app">
    <style>{css}</style>
    <header className="faculty-top">
      <a className="faculty-brand" href="#faculte" onClick={event=>{event.preventDefault();setActive("overview");}}>
        <img src="/ifac-logo.svg" alt=""/><span>iFac <span>universite</span></span>
      </a>
      <div className="faculty-actions"><span className="faculty-user">{user.firstName} {user.lastName}</span>
        <button className="faculty-button secondary" type="button" onClick={onLogout}>Déconnexion</button></div>
    </header>
    <div className="faculty-layout">
      <aside className="faculty-side" aria-label="Navigation du responsable de faculté">
        <p className="faculty-nav-title">ESPACE RESPONSABLE DE FACULTÉ</p>
        {nav.map(([id,label,icon])=><button key={id} type="button" className={active===id?"faculty-nav active":"faculty-nav"} onClick={()=>setActive(id)}>
          <span className="faculty-nav-icon" aria-hidden="true">{icon}</span>{label}
        </button>)}
        <div className="faculty-side-note">Accès limité aux facultés officiellement attribuées à votre compte.</div>
      </aside>
      <section className="faculty-main" aria-live="polite">
        <div className="faculty-heading">
          <div><p className="faculty-eyebrow">iFAC UNIVERSITÉ · GESTION ACADÉMIQUE</p><h1>{page[0]}</h1><p>{page[1]}</p></div>
          <div className="faculty-actions"><button className="faculty-button secondary" type="button" onClick={load} disabled={loading||busy}>Actualiser</button><span className="faculty-badge">RESPONSABLE DE FACULTÉ</span></div>
        </div>
        {scopes.length>0&&<div className="faculty-scope"><strong>Votre périmètre :</strong> {scopes.map(x=>x.university_name+" · "+x.faculty_name).join(" / ")}</div>}
        {feedback&&<p className="faculty-feedback" role="status">{feedback}</p>}
        {loading?<div className="faculty-empty">Chargement de votre espace…</div>:<>
          {active==="overview"&&<>
            <div className="faculty-grid">
              <article className="faculty-card"><div className="faculty-stat-label">Étudiants</div><div className="faculty-stat-value">{overview.students??0}</div></article>
              <article className="faculty-card"><div className="faculty-stat-label">Programmes actifs</div><div className="faculty-stat-value">{overview.programs??0}</div></article>
              <article className="faculty-card"><div className="faculty-stat-label">Responsables de programme</div><div className="faculty-stat-value">{overview.programManagers??0}</div></article>
              <article className="faculty-card"><div className="faculty-stat-label">Cours actifs</div><div className="faculty-stat-value">{overview.courses??0}</div></article>
              <article className="faculty-card"><div className="faculty-stat-label">Professeurs</div><div className="faculty-stat-value">{overview.professors??0}</div></article>
              <article className="faculty-card"><div className="faculty-stat-label">Documents pédagogiques</div><div className="faculty-stat-value">{overview.documents??0}</div></article>
            </div>
            <section className="faculty-card"><h2>Accès rapide</h2><div className="faculty-actions">
              <button className="faculty-button" onClick={()=>setActive("programs")}>Voir les programmes</button>
              <button className="faculty-button secondary" onClick={()=>setActive("managers")}>Gérer les responsables</button>
              <button className="faculty-button secondary" onClick={()=>setActive("documents")}>Voir les documents</button>
            </div></section>
          </>}
          {active==="programs"&&<section className="faculty-card"><h2>Programmes de votre faculté</h2>
            {programs.length?<div className="faculty-list">{programs.map(p=><article className="faculty-item" key={p.id}><div><strong>{p.name}</strong><div className="faculty-muted">{p.active_levels} niveaux actifs · {p.subjects} matières · {p.courses} cours</div></div><span className="faculty-pill">Actif</span></article>)}</div>:<div className="faculty-empty">Aucun programme actif dans votre périmètre.</div>}
          </section>}
          {active==="managers"&&<>
            <section className="faculty-card"><h2>Nommer un responsable de programme</h2>
              {!programs.length?<div className="faculty-empty">Aucun programme actif ne peut être attribué.</div>:<form className="faculty-form" onSubmit={appoint}>
                <label className="faculty-field full">Adresse e-mail du compte iFac<input type="email" required maxLength="254" value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))} placeholder="responsable@exemple.com"/></label>
                <label className="faculty-field full">Programme<select required value={form.optionId} onChange={e=>setForm(v=>({...v,optionId:e.target.value,studyLevelId:""}))}><option value="">Choisir un programme</option>{programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                <label className="faculty-field full">Périmètre de nomination<select value={form.studyLevelId} onChange={e=>setForm(v=>({...v,studyLevelId:e.target.value}))}><option value="">Tous les niveaux du programme</option>{visibleLevels.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
                <div className="faculty-field full"><button className="faculty-button" disabled={busy}>Nommer le responsable</button></div>
                <p className="faculty-muted faculty-field full">La personne doit déjà posséder un compte iFac actif. La nomination lui donne accès uniquement au programme et au niveau sélectionnés.</p>
              </form>}
            </section>
            <section className="faculty-card"><h2>Responsables nommés</h2>
              {managers.length?<div className="faculty-list">{managers.map(m=><article className="faculty-item" key={m.assignment_id}><div><strong>{m.first_name} {m.last_name}</strong><div className="faculty-muted">{m.email} · {m.option_name} · {m.level_label||"Tous les niveaux"}</div></div><div className="faculty-actions"><span className="faculty-pill">{m.status==="active"?"Actif":m.status==="pending"?"En attente":"Révoqué"}</span>{m.status==="pending"?<><button className="faculty-button" disabled={busy} onClick={()=>changeStatus(m,true)}>Valider</button><button className="faculty-button secondary" disabled={busy} onClick={()=>changeStatus(m,false)}>Refuser</button></>:m.status==="active"?<button className="faculty-button secondary" disabled={busy} onClick={()=>changeStatus(m,false)}>Retirer l’accès</button>:<button className="faculty-button" disabled={busy} onClick={()=>changeStatus(m,true)}>Réactiver</button>}}</div></article>)}</div>:<div className="faculty-empty">Aucun responsable de programme n’est encore nommé.</div>}
            </section>
          </>}
          {active==="professors"&&<section className="faculty-card"><h2>Professeurs affectés</h2>
            {professors.length?<div className="faculty-list">{professors.map(p=><article className="faculty-item" key={p.id}><div><strong>{p.first_name} {p.last_name}</strong><div className="faculty-muted">{p.email} · {p.courses} cours · {p.activated_at?"Compte activé":"Activation en attente"}</div></div><span className="faculty-pill">{p.is_active?"Actif":"Suspendu"}</span></article>)}</div>:<div className="faculty-empty">Aucun professeur déclaré dans cette faculté.</div>}
          </section>}
          {active==="documents"&&<section className="faculty-card"><h2>Documents pédagogiques de la faculté</h2>
            {documents.length?<div className="faculty-list">{documents.map(d=><article className="faculty-item" key={d.id}><div><strong>{d.title}</strong><div className="faculty-muted">{d.course||"Cours"} · {d.option_name||"Programme"} · {d.level_label||"Niveau non précisé"}</div></div><div className="faculty-actions"><span className="faculty-pill">{d.status==="approved"?"Publié":d.status==="pending"?"En attente":"Refusé"}</span>{d.status==="approved"&&<button className="faculty-button secondary" type="button" disabled={downloadingId===d.id} onClick={()=>downloadDocument(d)}>{downloadingId===d.id?"Téléchargement…":"Télécharger"}</button>}</div></article>)}</div>:<div className="faculty-empty">Aucun document pédagogique disponible.</div>}
          </section>}
        </>}
      </section>
    </div>
  </main>;
}
