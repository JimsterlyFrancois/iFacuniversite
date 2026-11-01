import { useEffect, useMemo, useState } from "react";

export default function ProfessorManagement({ token, request }) {
  const [catalog,setCatalog]=useState({universities:[],faculties:[],options:[],levels:[]});
  const [professors,setProfessors]=useState([]);
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [email,setEmail]=useState("");
  const [universityId,setUniversityId]=useState("");
  const [facultyId,setFacultyId]=useState("");
  const [optionId,setOptionId]=useState("");
  const [levelId,setLevelId]=useState("");
  const [targetId,setTargetId]=useState("");
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState("");
  const faculties=useMemo(()=>catalog.faculties.filter(x=>String(x.university_id)===String(universityId)),[catalog.faculties,universityId]);
  const options=useMemo(()=>catalog.options.filter(x=>String(x.faculty_id)===String(facultyId)),[catalog.options,facultyId]);
  const levels=useMemo(()=>catalog.levels.filter(x=>String(x.option_id)===String(optionId)),[catalog.levels,optionId]);
  const assignment=()=>({universityId:Number(universityId),facultyId:Number(facultyId),optionId:Number(optionId),studyLevelId:Number(levelId)});
  async function load(){
    setBusy(true);setFeedback("");
    try{
      const [c,p]=await Promise.all([request("/admin/professors/catalog",{token}),request("/admin/professors",{token})]);
      setCatalog(c.data||{universities:[],faculties:[],options:[],levels:[]});setProfessors(p.data||[]);
    }catch(e){setFeedback(e.message||"Impossible de charger les professeurs.");}
    finally{setBusy(false);}
  }
  useEffect(()=>{load();},[]);
  function resetAssignment(){setUniversityId("");setFacultyId("");setOptionId("");setLevelId("");}
  async function createProfessor(e){
    e.preventDefault();setBusy(true);setFeedback("");
    try{
      const r=await request("/admin/professors",{token,method:"POST",body:JSON.stringify({firstName,lastName,email,assignment:assignment()})});
      setFeedback(r.message);setFirstName("");setLastName("");setEmail("");resetAssignment();await load();
    }catch(e){setFeedback(e.message);}finally{setBusy(false);}
  }
  async function addAssignment(e){
    e.preventDefault();if(!targetId)return;setBusy(true);setFeedback("");
    try{
      const r=await request(`/admin/professors/${targetId}/assignments`,{token,method:"POST",body:JSON.stringify({assignment:assignment()})});
      setFeedback(r.message);resetAssignment();await load();
    }catch(e){setFeedback(e.message);}finally{setBusy(false);}
  }
  async function toggleStatus(p){
    setBusy(true);setFeedback("");
    try{const r=await request(`/admin/professors/${p.id}/status`,{token,method:"PATCH",body:JSON.stringify({active:!p.is_active})});setFeedback(r.message);await load();}
    catch(e){setFeedback(e.message);}finally{setBusy(false);}
  }
  const assignmentFields=<>
    <label className="field"><span>Université</span><select required value={universityId} onChange={e=>{setUniversityId(e.target.value);setFacultyId("");setOptionId("");setLevelId("");}}><option value="">Choisir</option>{catalog.universities.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label className="field"><span>Faculté</span><select required disabled={!universityId} value={facultyId} onChange={e=>{setFacultyId(e.target.value);setOptionId("");setLevelId("");}}><option value="">Choisir</option>{faculties.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label className="field"><span>Option</span><select required disabled={!facultyId} value={optionId} onChange={e=>{setOptionId(e.target.value);setLevelId("");}}><option value="">Choisir</option>{options.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label className="field"><span>Niveau</span><select required disabled={!optionId} value={levelId} onChange={e=>setLevelId(e.target.value)}><option value="">Choisir</option>{levels.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
  </>;
  return <div className="profile-page">
    <section className="student-card">
      <h2>Déclarer un professeur</h2>
      <p>Enregistrez son adresse e-mail et sa première affectation. Le professeur utilisera cette adresse pour créer son code secret et activer son compte après confirmation par e-mail.</p>
      <form className="auth-form" onSubmit={createProfessor}>
        <div className="field-row"><label className="field"><span>Prénom</span><input required maxLength="100" value={firstName} onChange={e=>setFirstName(e.target.value)}/></label><label className="field"><span>Nom</span><input required maxLength="100" value={lastName} onChange={e=>setLastName(e.target.value)}/></label></div>
        <label className="field"><span>Adresse e-mail du professeur</span><input type="email" required maxLength="254" value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <h3>Première affectation</h3><div className="field-row">{assignmentFields}</div>
        <button className="submit-button" disabled={busy||!universityId||!facultyId||!optionId||!levelId}>Déclarer le professeur</button>
      </form>
    </section>
    <section className="student-card">
      <h2>Professeurs déclarés</h2>
      {professors.length===0&&!busy?<p>Aucun professeur déclaré pour le moment.</p>:professors.map(p=><article className="student-data-item" key={p.id}>
        <div><strong>{p.first_name} {p.last_name}</strong><p>{p.email}</p><small>{p.activated_at?"Compte activé":"En attente d’activation"} · {p.is_active?"Accès actif":"Accès suspendu"}</small></div>
        <ul>{(p.assignments||[]).map(a=><li key={a.id}>{a.university_name} · {a.faculty_name} · {a.option_name} · {a.level_label}</li>)}</ul>
        <button type="button" className="theme-button" onClick={()=>{setTargetId(String(p.id));setFeedback("Ajoutez une autre affectation pour "+p.first_name+" "+p.last_name+".");}}>Ajouter une affectation</button>
        <button type="button" className="theme-button" disabled={busy} onClick={()=>toggleStatus(p)}>{p.is_active?"Suspendre l’accès":"Réactiver l’accès"}</button>
      </article>)}
    </section>
    {targetId&&<section className="student-card">
      <h2>Ajouter une affectation</h2><p>Cette affectation sera ajoutée sans modifier les précédentes.</p>
      <form className="auth-form" onSubmit={addAssignment}><div className="field-row">{assignmentFields}</div><div className="field-row"><button className="submit-button" disabled={busy||!universityId||!facultyId||!optionId||!levelId}>Enregistrer l’affectation</button><button type="button" className="theme-button" onClick={()=>{setTargetId("");resetAssignment();}}>Annuler</button></div></form>
    </section>}
    {feedback&&<p className="form-feedback" role="status">{feedback}</p>}
  </div>;
}
