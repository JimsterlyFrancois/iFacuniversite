import { useCallback, useEffect, useMemo, useState } from "react";

const nav = [
  ["overview","Tableau de bord"],["faculties","Facultés"],["options","Options"],["levels","Niveaux d’études"],
  ["managers","Responsables de faculté"],["announcements","Annonces"]
];
const css = `
.ua-app{min-height:100vh;background:#f4f6f9;color:#171717;font-family:inherit}
.ua-top{height:68px;background:#fff;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:sticky;top:0;z-index:5}
.ua-brand{display:flex;align-items:center;gap:9px;color:#171717;text-decoration:none;font-weight:800}.ua-brand img{width:34px;height:34px;object-fit:contain}.ua-brand em{font-style:normal;color:#a16207;font-weight:400}
.ua-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ua-user{font-size:12px;color:#555;background:#f4f4f4;border-radius:24px;padding:9px 12px}
.ua-layout{display:grid;grid-template-columns:245px minmax(0,1fr);min-height:calc(100vh - 68px)}.ua-side{background:#fff;border-right:1px solid #e5e7eb;padding:22px 13px;display:flex;flex-direction:column;gap:6px}
.ua-kicker{font-size:10px;letter-spacing:.12em;font-weight:800;color:#999;padding:0 10px 10px}.ua-nav{border:0;background:transparent;text-align:left;padding:12px;border-radius:9px;color:#555;font:inherit;font-size:13px;cursor:pointer}.ua-nav.active{background:#fff2ce;color:#795000;font-weight:800}
.ua-note{margin-top:auto;padding:12px 10px;border-top:1px solid #eee;color:#888;font-size:11px;line-height:1.5}
.ua-main{max-width:1280px;width:100%;margin:0 auto;padding:30px}.ua-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:22px}.ua-eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;color:#9a6b12;margin:0 0 7px}.ua-heading h1{font-size:26px;margin:0 0 7px}.ua-heading p{font-size:13px;color:#777;margin:0}
.ua-badge{background:#fff0c7;color:#805400;border-radius:20px;padding:8px 11px;font-size:10px;font-weight:800;white-space:nowrap}
.ua-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}.ua-card{background:#fff;border:1px solid #e8e9ec;border-radius:12px;padding:17px;margin-bottom:14px}.ua-card h2{font-size:15px;margin:0 0 12px}.ua-stat-label{font-size:11px;color:#777}.ua-stat{font-size:26px;font-weight:800;margin-top:7px}
.ua-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.ua-field{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700;color:#555}.ua-field.full{grid-column:1/-1}
.ua-field input,.ua-field select,.ua-field textarea{width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:8px;padding:10px;background:#fff;color:#222;font:inherit;font-size:12px}.ua-field textarea{min-height:95px}
.ua-btn{border:0;border-radius:8px;background:#e9aa0b;color:#171717;padding:10px 13px;font:inherit;font-size:11px;font-weight:800;cursor:pointer}.ua-btn.secondary{background:#eee;color:#444}.ua-btn.danger{background:#fce8e6;color:#922}.ua-btn:disabled{opacity:.5;cursor:not-allowed}
.ua-list{display:flex;flex-direction:column;gap:8px}.ua-item{border:1px solid #eee;border-radius:9px;padding:11px;display:flex;justify-content:space-between;align-items:center;gap:12px}.ua-item strong{font-size:12px}.ua-muted{font-size:10px;color:#888;margin-top:4px}.ua-pill{background:#f2f2f2;border-radius:20px;padding:5px 8px;font-size:10px;color:#666;white-space:nowrap}
.ua-feedback{padding:10px 12px;border-radius:8px;background:#fff5d9;color:#765000;font-size:12px;margin:0 0 14px}.ua-empty{padding:20px;border:1px dashed #ddd;border-radius:10px;color:#888;text-align:center;font-size:12px}.ua-scope{padding:12px 14px;background:#fffaf0;border:1px solid #f0dfb5;border-radius:9px;color:#795000;font-size:11px;margin-bottom:15px}
@media(max-width:850px){.ua-layout{grid-template-columns:1fr}.ua-side{position:sticky;top:68px;z-index:4;flex-direction:row;overflow:auto;padding:7px;border:0;border-bottom:1px solid #eee}.ua-kicker,.ua-note{display:none}.ua-nav{white-space:nowrap;padding:10px;font-size:11px}.ua-main{padding:20px 14px}.ua-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.ua-top{height:60px;padding:0 12px}.ua-layout{min-height:calc(100vh - 60px)}.ua-side{top:60px}.ua-user{display:none}.ua-heading{flex-direction:column}.ua-heading h1{font-size:22px}.ua-form{grid-template-columns:1fr}.ua-field.full{grid-column:auto}.ua-item{align-items:flex-start;flex-direction:column}.ua-grid{gap:8px}.ua-card{padding:13px}}
`;

const blank = { code:"", name:"" };
export default function UniversityAdminShell({ token, user, onLogout, request }) {
  const [tab,setTab]=useState("overview"),[overview,setOverview]=useState({});
  const [scopes,setScopes]=useState([]),[scopeAssignmentId,setScopeAssignmentId]=useState("");
  const [catalog,setCatalog]=useState({faculties:[],options:[],levels:[]});
  const [managers,setManagers]=useState([]),[announcements,setAnnouncements]=useState([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState("");
  const [facultyForm,setFacultyForm]=useState(blank),[editingFaculty,setEditingFaculty]=useState(null);
  const [optionForm,setOptionForm]=useState({facultyId:"",...blank}),[editingOption,setEditingOption]=useState(null);
  const [levelForm,setLevelForm]=useState({optionId:"",code:"",label:"",sortOrder:"1"}),[editingLevel,setEditingLevel]=useState(null);
  const [managerForm,setManagerForm]=useState({email:"",facultyId:""});
  const [notice,setNotice]=useState({scopeAssignmentId:"",title:"",body:""});

  const load=useCallback(async()=>{
    setLoading(true);setFeedback("");
    const paths=["/university-admin/overview","/university-admin/catalog","/university-admin/faculty-managers","/university-admin/announcements"];
    const results=await Promise.allSettled(paths.map(path=>request(path,{token})));
    if(results[0].status==="fulfilled")setOverview(results[0].value.data||{});
    if(results[1].status==="fulfilled"){
      const value=results[1].value;setCatalog(value.data||{faculties:[],options:[],levels:[]});
      const nextScopes=value.scopes||[];setScopes(nextScopes);
      setScopeAssignmentId(current=>current||String(nextScopes[0]?.assignment_id||""));
      setNotice(current=>({...current,scopeAssignmentId:current.scopeAssignmentId||String(nextScopes[0]?.assignment_id||"")}));
    }
    if(results[2].status==="fulfilled")setManagers(results[2].value.data||[]);
    if(results[3].status==="fulfilled")setAnnouncements(results[3].value.data||[]);
    const failed=results.find(item=>item.status==="rejected");
    if(failed)setFeedback(failed.reason?.message||"Certaines données n’ont pas pu être chargées.");
    setLoading(false);
  },[request,token]);
  useEffect(()=>{load();},[load]);

  const faculties=useMemo(()=>catalog.faculties||[],[catalog.faculties]);
  const options=useMemo(()=>catalog.options||[],[catalog.options]);
  const levels=useMemo(()=>catalog.levels||[],[catalog.levels]);
  const selectedScope=scopes.find(scope=>String(scope.assignment_id)===scopeAssignmentId);
  const pages={overview:["Vue d’ensemble","Pilotage et configuration de votre université."],faculties:["Facultés","Créez, modifiez ou désactivez les facultés de votre université."],options:["Options","Organisez les options à l’intérieur de chaque faculté."],levels:["Niveaux d’études","Définissez les niveaux pour chaque option."],managers:["Responsables de faculté","Nommez et gérez les responsables de faculté."],announcements:["Annonces","Publiez les informations officielles de votre université."]};

  async function action(path,method,body){
    setBusy(true);setFeedback("");
    try{const result=await request(path,{token,method,body:body?JSON.stringify(body):undefined});await load();setFeedback(result?.message||"Modification enregistrée.");return result;}
    catch(error){setFeedback(error.message);return null;}
    finally{setBusy(false);}
  }
  async function saveFaculty(event){
    event.preventDefault();
    const body={code:facultyForm.code,name:facultyForm.name,isActive:true};
    const result=editingFaculty
      ? await action("/university-admin/faculties/"+editingFaculty.id,"PATCH",body)
      : await action("/university-admin/faculties","POST",{...body,scopeAssignmentId:Number(scopeAssignmentId)});
    if(result){setFacultyForm(blank);setEditingFaculty(null);}
  }
  async function saveOption(event){
    event.preventDefault();
    const body={code:optionForm.code,name:optionForm.name,isActive:true};
    const result=editingOption
      ? await action("/university-admin/options/"+editingOption.id,"PATCH",body)
      : await action("/university-admin/options","POST",{...body,facultyId:Number(optionForm.facultyId)});
    if(result){setOptionForm({facultyId:"",...blank});setEditingOption(null);}
  }
  async function saveLevel(event){
    event.preventDefault();
    const body={code:levelForm.code,label:levelForm.label,sortOrder:Number(levelForm.sortOrder),isActive:true};
    const result=editingLevel
      ? await action("/university-admin/levels/"+editingLevel.id,"PATCH",body)
      : await action("/university-admin/levels","POST",{...body,optionId:Number(levelForm.optionId)});
    if(result){setLevelForm({optionId:"",code:"",label:"",sortOrder:"1"});setEditingLevel(null);}
  }
  async function appoint(event){
    event.preventDefault();
    const result=await action("/university-admin/faculty-managers","POST",{email:managerForm.email,facultyId:Number(managerForm.facultyId)});
    if(result)setManagerForm({email:"",facultyId:""});
  }
  async function publish(event){
    event.preventDefault();
    const result=await action("/university-admin/announcements","POST",{...notice,scopeAssignmentId:Number(notice.scopeAssignmentId)});
    if(result)setNotice(value=>({...value,title:"",body:""}));
  }
  function editFaculty(item){setEditingFaculty(item);setFacultyForm({code:item.code,name:item.name});}
  function editOption(item){setEditingOption(item);setOptionForm({facultyId:String(item.faculty_id),code:item.code,name:item.name});}
  function editLevel(item){setEditingLevel(item);setLevelForm({optionId:String(item.option_id),code:item.code,label:item.label,sortOrder:String(item.sort_order)});}

  return <main className="ua-app"><style>{css}</style>
    <header className="ua-top"><a className="ua-brand" href="#university" onClick={event=>{event.preventDefault();setTab("overview");}}><img src="/ifac-logo.svg" alt=""/>iFac <em>universite</em></a>
      <div className="ua-actions"><span className="ua-user">{user.firstName} {user.lastName}</span><button className="ua-btn secondary" type="button" onClick={onLogout}>Déconnexion</button></div>
    </header>
    <div className="ua-layout">
      <aside className="ua-side" aria-label="Navigation administrateur d’université">
        <div className="ua-kicker">ADMINISTRATION UNIVERSITAIRE</div>
        {nav.map(([id,label])=><button key={id} type="button" className={tab===id?"ua-nav active":"ua-nav"} onClick={()=>setTab(id)}>{label}</button>)}
        <div className="ua-note">Vous gérez la structure académique des universités attribuées à votre compte. La création d’universités et la nomination de leurs administrateurs restent réservées à l’administration générale.</div>
      </aside>
      <section className="ua-main" aria-live="polite">
        <div className="ua-heading"><div><p className="ua-eyebrow">iFAC UNIVERSITÉ · PILOTAGE INSTITUTIONNEL</p><h1>{pages[tab][0]}</h1><p>{pages[tab][1]}</p></div>
          <div className="ua-actions"><button className="ua-btn secondary" type="button" onClick={load} disabled={loading||busy}>Actualiser</button><span className="ua-badge">RESPONSABLE D’UNIVERSITÉ</span></div>
        </div>
        {scopes.length>1&&<div className="ua-card"><label className="ua-field">Université administrée<select value={scopeAssignmentId} onChange={event=>setScopeAssignmentId(event.target.value)}>{scopes.map(scope=><option key={scope.assignment_id} value={scope.assignment_id}>{scope.university_name}</option>)}</select></label></div>}
        {scopes.length>0&&<div className="ua-scope"><strong>Périmètre autorisé :</strong> {selectedScope?.university_name||scopes.map(scope=>scope.university_name).join(" · ")}</div>}
        {feedback&&<p className="ua-feedback" role="status">{feedback}</p>}
        {loading?<div className="ua-empty">Chargement des données universitaires…</div>:<>
          {tab==="overview"&&<>
            <div className="ua-grid">{[["Facultés",overview.faculties],["Options",overview.programs],["Étudiants",overview.students],["Professeurs",overview.professors],["Responsables de faculté",overview.facultyManagers],["Responsables de programme",overview.programManagers],["Cours actifs",overview.courses],["Documents",overview.documents],["Annonces",overview.announcements]].map(([label,value])=><article className="ua-card" key={label}><div className="ua-stat-label">{label}</div><div className="ua-stat">{value??0}</div></article>)}</div>
            <article className="ua-card"><h2>État des inscriptions</h2>{selectedScope?.registration_enabled?<p className="ua-muted">Les inscriptions étudiantes sont ouvertes.</p>:<><p className="ua-muted">Les inscriptions restent fermées jusqu’à la configuration d’au moins une faculté, une option et un niveau actif.</p><button className="ua-btn" disabled={busy||!faculties.some(f=>f.is_active)||!options.some(o=>o.is_active)||!levels.some(l=>l.is_active)} onClick={()=>action("/university-admin/registration/enable","POST",{scopeAssignmentId:Number(scopeAssignmentId)})}>Ouvrir les inscriptions</button></>}</article>
          </>}
          {tab==="faculties"&&<>
            <article className="ua-card"><h2>{editingFaculty?"Modifier une faculté":"Créer une faculté"}</h2><form className="ua-form" onSubmit={saveFaculty}>
              <label className="ua-field">Code unique<input required maxLength="32" value={facultyForm.code} onChange={e=>setFacultyForm(v=>({...v,code:e.target.value.toUpperCase()}))}/></label>
              <label className="ua-field">Nom de la faculté<input required maxLength="180" value={facultyForm.name} onChange={e=>setFacultyForm(v=>({...v,name:e.target.value}))}/></label>
              <div className="ua-field full"><div className="ua-actions"><button className="ua-btn" disabled={busy||(!scopeAssignmentId&&scopes.length===1?false:!scopeAssignmentId)}>{editingFaculty?"Enregistrer":"Créer la faculté"}</button>{editingFaculty&&<button className="ua-btn secondary" type="button" onClick={()=>{setEditingFaculty(null);setFacultyForm(blank);}}>Annuler</button>}</div></div>
            </form></article>
            <article className="ua-card"><h2>Facultés enregistrées</h2><div className="ua-list">{faculties.map(item=><div className="ua-item" key={item.id}><div><strong>{item.name}</strong><div className="ua-muted">{item.code} · {item.is_active?"Active":"Désactivée"}</div></div><div className="ua-actions"><button className="ua-btn secondary" type="button" onClick={()=>editFaculty(item)}>Modifier</button>{item.is_active&&<button className="ua-btn danger" type="button" disabled={busy} onClick={()=>action("/university-admin/faculties/"+item.id,"DELETE")}>Désactiver</button>}</div></div>)}</div>{!faculties.length&&<div className="ua-empty">Aucune faculté enregistrée.</div>}</article>
          </>}
          {tab==="options"&&<>
            <article className="ua-card"><h2>{editingOption?"Modifier une option":"Créer une option"}</h2><form className="ua-form" onSubmit={saveOption}>
              <label className="ua-field full">Faculté<select required value={optionForm.facultyId} disabled={Boolean(editingOption)} onChange={e=>setOptionForm(v=>({...v,facultyId:e.target.value}))}><option value="">Choisir une faculté</option>{faculties.filter(f=>f.is_active).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
              <label className="ua-field">Code unique<input required maxLength="32" value={optionForm.code} onChange={e=>setOptionForm(v=>({...v,code:e.target.value.toUpperCase()}))}/></label>
              <label className="ua-field">Nom de l’option<input required maxLength="180" value={optionForm.name} onChange={e=>setOptionForm(v=>({...v,name:e.target.value}))}/></label>
              <div className="ua-field full"><div className="ua-actions"><button className="ua-btn" disabled={busy||!optionForm.facultyId}>{editingOption?"Enregistrer":"Créer l’option"}</button>{editingOption&&<button className="ua-btn secondary" type="button" onClick={()=>{setEditingOption(null);setOptionForm({facultyId:"",...blank});}}>Annuler</button>}</div></div>
            </form></article>
            <article className="ua-card"><h2>Options enregistrées</h2><div className="ua-list">{options.map(item=><div className="ua-item" key={item.id}><div><strong>{item.name}</strong><div className="ua-muted">{item.code} · {faculties.find(f=>Number(f.id)===Number(item.faculty_id))?.name||"Faculté"} · {item.is_active?"Active":"Désactivée"}</div></div><div className="ua-actions"><button className="ua-btn secondary" type="button" onClick={()=>editOption(item)}>Modifier</button>{item.is_active&&<button className="ua-btn danger" type="button" disabled={busy} onClick={()=>action("/university-admin/options/"+item.id,"DELETE")}>Désactiver</button>}</div></div>)}</div>{!options.length&&<div className="ua-empty">Aucune option enregistrée.</div>}</article>
          </>}
          {tab==="levels"&&<>
            <article className="ua-card"><h2>{editingLevel?"Modifier un niveau":"Créer un niveau d’études"}</h2><form className="ua-form" onSubmit={saveLevel}>
              <label className="ua-field full">Option<select required value={levelForm.optionId} disabled={Boolean(editingLevel)} onChange={e=>setLevelForm(v=>({...v,optionId:e.target.value}))}><option value="">Choisir une option</option>{options.filter(o=>o.is_active).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
              <label className="ua-field">Code<input required maxLength="16" value={levelForm.code} onChange={e=>setLevelForm(v=>({...v,code:e.target.value.toUpperCase()}))} placeholder="L1"/></label>
              <label className="ua-field">Libellé<input required maxLength="80" value={levelForm.label} onChange={e=>setLevelForm(v=>({...v,label:e.target.value}))} placeholder="1re année (L1)"/></label>
              <label className="ua-field">Ordre d’affichage<input type="number" min="1" max="100" required value={levelForm.sortOrder} onChange={e=>setLevelForm(v=>({...v,sortOrder:e.target.value}))}/></label>
              <div className="ua-field full"><div className="ua-actions"><button className="ua-btn" disabled={busy||!levelForm.optionId}>{editingLevel?"Enregistrer":"Créer le niveau"}</button>{editingLevel&&<button className="ua-btn secondary" type="button" onClick={()=>{setEditingLevel(null);setLevelForm({optionId:"",code:"",label:"",sortOrder:"1"});}}>Annuler</button>}</div></div>
            </form></article>
            <article className="ua-card"><h2>Niveaux enregistrés</h2><div className="ua-list">{levels.map(item=><div className="ua-item" key={item.id}><div><strong>{item.label}</strong><div className="ua-muted">{item.code} · {options.find(o=>Number(o.id)===Number(item.option_id))?.name||"Option"} · ordre {item.sort_order} · {item.is_active?"Actif":"Désactivé"}</div></div><div className="ua-actions"><button className="ua-btn secondary" type="button" onClick={()=>editLevel(item)}>Modifier</button>{item.is_active&&<button className="ua-btn danger" type="button" disabled={busy} onClick={()=>action("/university-admin/levels/"+item.id,"DELETE")}>Désactiver</button>}</div></div>)}</div>{!levels.length&&<div className="ua-empty">Aucun niveau enregistré.</div>}</article>
          </>}
          {tab==="managers"&&<>
            <article className="ua-card"><h2>Nommer un responsable de faculté</h2><form className="ua-form" onSubmit={appoint}><label className="ua-field full">Adresse e-mail du compte iFac<input type="email" required maxLength="254" value={managerForm.email} onChange={e=>setManagerForm(v=>({...v,email:e.target.value}))}/></label><label className="ua-field full">Faculté<select required value={managerForm.facultyId} onChange={e=>setManagerForm(v=>({...v,facultyId:e.target.value}))}><option value="">Choisir une faculté</option>{faculties.filter(f=>f.is_active).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><div className="ua-field full"><button className="ua-btn" disabled={busy||!managerForm.facultyId}>Nommer le responsable</button></div></form></article>
            <article className="ua-card"><h2>Responsables nommés</h2><div className="ua-list">{managers.map(m=><div className="ua-item" key={m.assignment_id}><div><strong>{m.first_name} {m.last_name}</strong><div className="ua-muted">{m.email} · {m.faculty_name}</div></div><div className="ua-actions"><span className="ua-pill">{m.status==="pending"?"En attente":m.status==="active"?"Actif":"Révoqué"}</span>{m.status==="pending"?<><button className="ua-btn" type="button" disabled={busy} onClick={()=>action("/university-admin/faculty-managers/"+m.assignment_id+"/status","PATCH",{active:true})}>Valider</button><button className="ua-btn secondary" type="button" disabled={busy} onClick={()=>action("/university-admin/faculty-managers/"+m.assignment_id+"/status","PATCH",{active:false})}>Refuser</button></>:<button className="ua-btn secondary" type="button" disabled={busy} onClick={()=>action("/university-admin/faculty-managers/"+m.assignment_id+"/status","PATCH",{active:m.status!=="active"})}>{m.status==="active"?"Retirer":"Réactiver"}</button>}</div></div>)}</div>{!managers.length&&<div className="ua-empty">Aucun responsable nommé.</div>}</article>
          </>}
          {tab==="announcements"&&<>
            <article className="ua-card"><h2>Publier une annonce</h2><form className="ua-form" onSubmit={publish}><label className="ua-field full">Université<select required value={notice.scopeAssignmentId} onChange={e=>setNotice(v=>({...v,scopeAssignmentId:e.target.value}))}>{scopes.map(s=><option key={s.assignment_id} value={s.assignment_id}>{s.university_name}</option>)}</select></label><label className="ua-field full">Titre<input required maxLength="220" value={notice.title} onChange={e=>setNotice(v=>({...v,title:e.target.value}))}/></label><label className="ua-field full">Contenu<textarea required maxLength="20000" value={notice.body} onChange={e=>setNotice(v=>({...v,body:e.target.value}))}/></label><div className="ua-field full"><button className="ua-btn" disabled={busy}>Publier l’annonce</button></div></form></article>
            <article className="ua-card"><h2>Historique</h2><div className="ua-list">{announcements.map(a=><div className="ua-item" key={a.id}><div><strong>{a.title}</strong><div className="ua-muted">{new Date(a.created_at).toLocaleString("fr-FR")} · {a.body}</div></div><span className="ua-pill">{a.is_active?"Active":"Archivée"}</span></div>)}</div>{!announcements.length&&<div className="ua-empty">Aucune annonce publiée.</div>}</article>
          </>}
        </>}
      </section>
    </div>
  </main>;
}
