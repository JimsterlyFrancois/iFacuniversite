import { useCallback, useEffect, useMemo, useState } from "react";

const tabs = [
  { id: "home", label: "Vue d’ensemble", icon: "⌂" },
  { id: "courses", label: "Cours du programme", icon: "▤" },
  { id: "professors", label: "Professeurs", icon: "♙" },
  { id: "documents", label: "Ressources pédagogiques", icon: "▧" }
];

const styles = `
.program-app{min-height:100vh;background:#f5f6f8;color:#171717;font-family:inherit}
.program-topbar{height:68px;background:#fff;border-bottom:1px solid #e7e7e7;display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:5}
.program-brand{display:flex;align-items:center;gap:10px;font-weight:800;color:#171717;text-decoration:none}.program-brand img{width:34px;height:34px;object-fit:contain}.program-brand span span{font-weight:400;color:#a16207}
.program-actions{display:flex;align-items:center;gap:12px}.program-user{font-size:13px;color:#555;background:#f5f5f5;border-radius:30px;padding:9px 13px}
.program-layout{display:grid;grid-template-columns:250px minmax(0,1fr);min-height:calc(100vh - 68px)}
.program-sidebar{background:#fff;border-right:1px solid #e7e7e7;padding:26px 16px;display:flex;flex-direction:column;gap:7px}
.program-nav-title{font-size:10px;font-weight:800;letter-spacing:.13em;color:#999;padding:0 12px 12px}
.program-nav{border:0;background:transparent;text-align:left;padding:12px;border-radius:10px;display:flex;align-items:center;gap:11px;color:#555;font:inherit;font-size:14px;cursor:pointer}
.program-nav:hover{background:#f8f4e9;color:#171717}.program-nav.active{background:#fff4d6;color:#805400;font-weight:700}
.program-icon{width:25px;height:25px;display:grid;place-items:center;border-radius:7px;background:#f3f3f3;font-weight:700}.program-nav.active .program-icon{background:#f6df9f}
.program-side-note{margin-top:auto;padding:14px 12px;color:#999;font-size:11px;border-top:1px solid #eee}
.program-main{padding:34px;max-width:1200px;width:100%;margin:0 auto}
.program-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:26px}
.program-eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;color:#9a6b12;margin:0 0 8px}
.program-heading h1{font-size:28px;line-height:1.2;margin:0 0 8px}.program-heading p{color:#777;margin:0;font-size:14px}
.program-badge{font-size:11px;font-weight:800;letter-spacing:.08em;color:#805400;background:#fff0c7;border-radius:20px;padding:9px 13px}
.program-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:20px}
.program-card{background:#fff;border:1px solid #e9e9e9;border-radius:14px;padding:20px;box-shadow:0 2px 8px #00000005;margin-bottom:16px}
.program-stat-label{font-size:12px;color:#777}.program-stat-value{font-size:28px;font-weight:800;margin-top:8px}
.program-card h2{font-size:16px;margin:0 0 14px}.program-card p{font-size:13px;line-height:1.6;color:#666}
.program-list{display:flex;flex-direction:column;gap:10px}
.program-item{border:1px solid #eee;border-radius:11px;padding:14px;display:flex;justify-content:space-between;gap:15px;align-items:center}
.program-item strong{font-size:14px}.program-muted{font-size:12px;color:#888;margin-top:4px}
.program-pill{display:inline-flex;background:#f4f4f4;border-radius:20px;padding:5px 9px;font-size:11px;color:#666;white-space:nowrap}
.program-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
.program-field{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:#555}
.program-field.full{grid-column:1/-1}
.program-field input,.program-field select,.program-field textarea{width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:9px;padding:11px 12px;background:#fff;color:#222;font:inherit;font-size:13px}
.program-button{border:0;border-radius:9px;padding:11px 15px;background:#e9a900;color:#171717;font:inherit;font-size:13px;font-weight:800;cursor:pointer}
.program-button:disabled{opacity:.55;cursor:not-allowed}.program-button.secondary{background:#f0f0f0;color:#444}
.program-feedback{padding:11px 13px;border-radius:9px;background:#fff5d9;color:#775000;font-size:13px;margin:0 0 16px}
.program-empty{padding:24px;text-align:center;color:#888;border:1px dashed #ddd;border-radius:12px;font-size:13px}
.program-scope{padding:14px 16px;border:1px solid #f0dfb5;background:#fffaf0;border-radius:11px;color:#775000;font-size:12px;margin-bottom:18px}
.program-form-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
@media(max-width:900px){.program-layout{grid-template-columns:1fr}.program-sidebar{position:sticky;top:68px;z-index:4;flex-direction:row;overflow-x:auto;padding:9px;border-right:0;border-bottom:1px solid #e7e7e7}.program-nav-title,.program-side-note{display:none}.program-nav{white-space:nowrap;padding:9px 11px;font-size:12px}.program-main{padding:22px 16px}.program-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.program-topbar{padding:0 14px;height:60px}.program-layout{min-height:calc(100vh - 60px)}.program-sidebar{top:60px}.program-user{display:none}.program-heading h1{font-size:23px}.program-grid{gap:9px}.program-card{padding:14px}.program-stat-value{font-size:23px}.program-form{grid-template-columns:1fr}.program-field.full{grid-column:auto}.program-item{align-items:flex-start;flex-direction:column}}
`;

export default function ProgramManagerShell({ token, user, onLogout, request }) {
  const [active, setActive] = useState("home");
  const [overview, setOverview] = useState({ students: 0, courses: 0, professors: 0, documents: 0 });
  const [scopes, setScopes] = useState([]);
  const [catalog, setCatalog] = useState({ subjects: [], courses: [] });
  const [professors, setProfessors] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [subjectForm, setSubjectForm] = useState({ optionId: "", studyLevelId: "", name: "" });
  const [courseName, setCourseName] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [professorForm, setProfessorForm] = useState({ firstName: "", lastName: "", email: "", courseId: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      request("/program-manager/overview", { token }),
      request("/program-manager/catalog", { token }),
      request("/program-manager/professors", { token }),
      request("/program-manager/documents", { token })
    ]);
    if (results[0].status === "fulfilled") {
      setOverview(results[0].value.data || {});
      setScopes(results[0].value.scopes || []);
    }
    if (results[1].status === "fulfilled") setCatalog(results[1].value.data || { subjects: [], courses: [] });
    if (results[2].status === "fulfilled") setProfessors(results[2].value.data || []);
    if (results[3].status === "fulfilled") setDocuments(results[3].value.data || []);
    const failed = results.find(item => item.status === "rejected");
    if (failed) setFeedback(failed.reason?.message || "Certaines informations n’ont pas pu être chargées.");
    setLoading(false);
  }, [request, token]);

  useEffect(() => { load(); }, [load]);

  const courses = useMemo(() => catalog.courses || [], [catalog]);
  const levels = useMemo(() => catalog.levels || [], [catalog]);
  const page = {
    home: ["Vue d’ensemble", "Suivez les activités du programme universitaire dont vous avez la responsabilité."],
    courses: ["Cours du programme", "Consultez les cours existants et ajoutez ceux qui relèvent de votre programme."],
    professors: ["Gestion des professeurs", "Examinez les demandes des professeurs et validez leur accès en leur attribuant un cours de votre programme."],
    documents: ["Ressources pédagogiques", "Consultez les documents publiés dans votre périmètre de responsabilité."]
  }[active];

  async function downloadDocument(doc) {
    setDownloadingId(doc.id); setFeedback("");
    try {
      const response = await fetch(`/api/v1/program-manager/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Téléchargement impossible pour ce document.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = doc.file_name || `document-ifac-${doc.id}`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) { setFeedback(error.message); }
    finally { setDownloadingId(null); }
  }

  async function createSubject(event) {
    event.preventDefault();
    setBusy(true); setFeedback("");
    try {
      const result = await request("/program-manager/subjects", {
        token, method: "POST",
        body: JSON.stringify({ optionId: Number(subjectForm.optionId), studyLevelId: Number(subjectForm.studyLevelId), name: subjectForm.name })
      });
      setSubjectForm({ optionId: "", studyLevelId: "", name: "" });
      setFeedback(result.message || "Matière créée.");
      await load();
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }

  async function deactivateSubject(subject) {
    if (!window.confirm("Désactiver la matière « " + subject.name + " » ? Les cours et documents existants seront conservés.")) return;
    setBusy(true); setFeedback("");
    try {
      const result = await request("/program-manager/subjects/" + subject.id, { token, method: "DELETE" });
      setFeedback(result.message || "Matière désactivée.");
      await load();
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }

  async function createCourse(event) {
    event.preventDefault();
    setBusy(true); setFeedback("");
    try {
      const result = await request("/program-manager/courses", {
        token, method: "POST",
        body: JSON.stringify({ subjectId: Number(subjectId), name: courseName, description: courseDescription })
      });
      setCourseName(""); setCourseDescription(""); setSubjectId("");
      setFeedback(result.message || "Cours créé.");
      await load();
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }

  async function createProfessor(event) {
    event.preventDefault();
    setBusy(true); setFeedback("");
    try {
      const result = await request("/program-manager/professors", {
        token, method: "POST", body: JSON.stringify(professorForm)
      });
      setProfessorForm({ firstName: "", lastName: "", email: "", courseId: "" });
      setFeedback(result.message || "Professeur déclaré.");
      await load();
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }

  return <main className="program-app">
    <style>{styles}</style>
    <header className="program-topbar">
      <a className="program-brand" href="#programme" onClick={event => { event.preventDefault(); setActive("home"); }}>
        <img src="/ifac-logo.svg" alt="" /><span>iFac <span>universite</span></span>
      </a>
      <div className="program-actions">
        <span className="program-user">{user.firstName} {user.lastName}</span>
        <button className="program-button secondary" type="button" onClick={onLogout}>Déconnexion</button>
      </div>
    </header>
    <div className="program-layout">
      <aside className="program-sidebar" aria-label="Navigation du responsable de programme">
        <p className="program-nav-title">ESPACE RESPONSABLE DE PROGRAMME</p>
        {tabs.map(tab => <button key={tab.id} type="button" className={active === tab.id ? "program-nav active" : "program-nav"} onClick={() => setActive(tab.id)}>
          <span className="program-icon" aria-hidden="true">{tab.icon}</span>{tab.label}
        </button>)}
        <div className="program-side-note">Accès limité aux programmes officiellement attribués à votre compte.</div>
      </aside>
      <section className="program-main" aria-live="polite">
        <div className="program-heading">
          <div><p className="program-eyebrow">iFAC UNIVERSITÉ · GESTION ACADÉMIQUE</p><h1>{page[0]}</h1><p>{page[1]}</p></div>
          <div className="program-form-actions"><button className="program-button secondary" type="button" onClick={load} disabled={loading || busy}>Actualiser</button><span className="program-badge">RESPONSABLE DE PROGRAMME</span></div>
        </div>
        {scopes.length > 0 && <div className="program-scope"><strong>Votre périmètre :</strong> {scopes.map(scope => [scope.university_name, scope.faculty_name, scope.option_name, scope.study_level_id ? "Niveau attribué" : "Tous les niveaux du programme"].filter(Boolean).join(" · ")).join(" / ")}</div>}
        {feedback && <p className="program-feedback" role="status">{feedback}</p>}
        {loading ? <div className="program-empty">Chargement de votre espace…</div> : <>
          {active === "home" && <>
            <div className="program-grid">
              <article className="program-card"><div className="program-stat-label">Étudiants du programme</div><div className="program-stat-value">{overview.students ?? 0}</div></article>
              <article className="program-card"><div className="program-stat-label">Cours actifs</div><div className="program-stat-value">{overview.courses ?? courses.length}</div></article>
              <article className="program-card"><div className="program-stat-label">Professeurs déclarés</div><div className="program-stat-value">{overview.professors ?? professors.length}</div></article>
              <article className="program-card"><div className="program-stat-label">Documents pédagogiques</div><div className="program-stat-value">{overview.documents ?? documents.length}</div></article>
            </div>
            <section className="program-card"><h2>Accès rapide</h2><div className="program-form-actions">
              <button className="program-button" onClick={() => setActive("courses")}>Gérer les cours</button>
              <button className="program-button secondary" onClick={() => setActive("professors")}>Gérer les professeurs</button>
              <button className="program-button secondary" onClick={() => setActive("documents")}>Voir les ressources</button>
            </div></section>
          </>}
          {active === "courses" && <>
            <section className="program-card"><h2>Créer une matière</h2>
              {!levels.length ? <div className="program-empty">Aucun niveau actif n’est disponible dans votre programme. Contactez le responsable de faculté pour vérifier le catalogue académique.</div> : <form className="program-form" onSubmit={createSubject}>
                <label className="program-field full">Option et niveau<select required value={subjectForm.studyLevelId} onChange={event => { const level = levels.find(item => String(item.study_level_id) === event.target.value); setSubjectForm(v => ({ ...v, studyLevelId: event.target.value, optionId: String(level?.option_id || "") })); }}><option value="">Choisir un niveau</option>{levels.map(level => <option key={level.study_level_id} value={level.study_level_id}>{level.option_name} · {level.level_label}</option>)}</select></label>
                <label className="program-field full">Nom de la matière<input required maxLength="180" value={subjectForm.name} onChange={event => setSubjectForm(v => ({ ...v, name: event.target.value }))} placeholder="Ex. : Introduction à la psychopédagogie" /></label>
                <div className="program-field full"><button className="program-button" disabled={busy || !subjectForm.studyLevelId}>Créer la matière</button></div>
              </form>}
            </section>
            <section className="program-card"><h2>Matières de votre programme</h2>
              {catalog.subjects?.length ? <div className="program-list">{catalog.subjects.map(subject => <article className="program-item" key={subject.id}><div><strong>{subject.name}</strong><div className="program-muted">{subject.option_name} · {subject.level_label}</div></div><button className="program-button secondary" type="button" disabled={busy} onClick={() => deactivateSubject(subject)}>Désactiver</button></article>)}</div> : <div className="program-empty">Aucune matière active. Créez-en une pour commencer à ajouter des cours.</div>}
            </section>
            <section className="program-card"><h2>Créer un cours</h2>
              {!catalog.subjects?.length ? <div className="program-empty">Créez d’abord une matière dans votre programme.</div> : <form className="program-form" onSubmit={createCourse}>
                <label className="program-field full">Matière<select required value={subjectId} onChange={event => setSubjectId(event.target.value)}><option value="">Choisir une matière</option>{catalog.subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.option_name} · {subject.level_label} · {subject.name}</option>)}</select></label>
                <label className="program-field full">Nom du cours<input required maxLength="180" value={courseName} onChange={event => setCourseName(event.target.value)} placeholder="Ex. : Introduction à la psychopédagogie" /></label>
                <label className="program-field full">Description (facultative)<textarea maxLength="3000" value={courseDescription} onChange={event => setCourseDescription(event.target.value)} /></label>
                <div className="program-field full"><button className="program-button" disabled={busy}>Créer le cours</button></div>
              </form>}
            </section>
            <section className="program-card"><h2>Cours de votre programme</h2>
              {courses.length ? <div className="program-list">{courses.map(course => <article className="program-item" key={course.id}><div><strong>{course.name}</strong><div className="program-muted">{course.option_name} · {course.level_label} · {course.subject_name}</div>{course.description && <div className="program-muted">{course.description}</div>}</div><span className="program-pill">Actif</span></article>)}</div> : <div className="program-empty">Aucun cours n’est encore créé dans votre programme.</div>}
            </section>
          </>}
          {active === "professors" && <>
            <section className="program-card"><h2>Déclarer ou valider un professeur</h2><p className="program-muted">Un professeur inscrit via l’espace professeur apparaît ici avec sa demande en attente. Attribuez-lui au moins un cours de votre programme pour activer son accès pédagogique.</p>
              {!courses.length ? <div className="program-empty">Créez ou faites créer un cours avant de pouvoir affecter un professeur.</div> : <form className="program-form" onSubmit={createProfessor}>
                <label className="program-field">Prénom<input required maxLength="100" value={professorForm.firstName} onChange={event => setProfessorForm(v => ({ ...v, firstName: event.target.value }))} /></label>
                <label className="program-field">Nom<input required maxLength="100" value={professorForm.lastName} onChange={event => setProfessorForm(v => ({ ...v, lastName: event.target.value }))} /></label>
                <label className="program-field full">Adresse e-mail<input type="email" required maxLength="254" value={professorForm.email} onChange={event => setProfessorForm(v => ({ ...v, email: event.target.value }))} placeholder="professeur@exemple.com" /></label>
                <label className="program-field full">Cours à attribuer<select required value={professorForm.courseId} onChange={event => setProfessorForm(v => ({ ...v, courseId: event.target.value }))}><option value="">Choisir un cours</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name} · {course.option_name} · {course.level_label}</option>)}</select></label>
                <div className="program-field full"><button className="program-button" disabled={busy}>Déclarer et affecter le professeur</button></div>
              </form>}
            </section>
            <section className="program-card"><h2>Professeurs et affectations</h2>
              {professors.length ? <div className="program-list">{professors.map(professor => <article className="program-item" key={professor.id}><div><strong>{professor.first_name} {professor.last_name}</strong><div className="program-muted">{professor.email} · {professor.activated_at ? "Inscrit sur iFac" : "Invitation envoyée"} · {professor.role_status === "active" ? "Accès pédagogique actif" : professor.role_status === "pending" ? "En attente de validation" : "Accès retiré"}</div>{(professor.assignments || []).map((assignment,index) => <div className="program-muted" key={assignment.assignment_id || index}>{assignment.course_name || "Demande d’affectation"} · {assignment.option_name} · {assignment.level_label} · {assignment.active ? "Affectation active" : "Suspendue"}</div>)}</div><span className="program-pill">{professor.is_active ? "Actif" : "Suspendu"}</span></article>)}</div> : <div className="program-empty">Aucun professeur n’est encore déclaré dans votre programme.</div>}
            </section>
          </>}
          {active === "documents" && <section className="program-card"><h2>Documents pédagogiques du programme</h2>
            {documents.length ? <div className="program-list">{documents.map(doc => <article className="program-item" key={doc.id}><div><strong>{doc.title}</strong><div className="program-muted">{doc.course || "Cours"} · {doc.option_name} · {doc.level_label}</div>{doc.description && <div className="program-muted">{doc.description}</div>}</div><div className="program-form-actions"><span className="program-pill">{doc.status === "approved" ? "Publié" : doc.status === "pending" ? "En attente" : "Refusé"}</span>{doc.status === "approved" && <button className="program-button secondary" type="button" onClick={() => downloadDocument(doc)} disabled={downloadingId === doc.id}>{downloadingId === doc.id ? "Téléchargement…" : "Télécharger"}</button>}</div></article>)}</div> : <div className="program-empty">Aucun document disponible dans votre périmètre.</div>}
          </section>}
        </>}
      </section>
    </div>
  </main>;
}
