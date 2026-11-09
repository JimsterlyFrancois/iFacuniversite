import { useCallback, useEffect, useMemo, useState } from "react";

const tabs = [
  { id: "home", label: "Vue d’ensemble", icon: "⌂" },
  { id: "courses", label: "Mes cours", icon: "▤" },
  { id: "documents", label: "Documents pédagogiques", icon: "▧" },
  { id: "notifications", label: "Notifications", icon: "◉" },
  { id: "profile", label: "Mon profil", icon: "○" }
];

const styles = `
.professor-app{min-height:100vh;background:#f5f6f8;color:#171717;font-family:inherit}
.professor-topbar{height:68px;background:#fff;border-bottom:1px solid #e7e7e7;display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:5}
.professor-brand{display:flex;align-items:center;gap:10px;font-weight:800;color:#171717;text-decoration:none}.professor-brand img{width:34px;height:34px;object-fit:contain}.professor-brand span span{font-weight:400;color:#a16207}
.professor-top-actions{display:flex;align-items:center;gap:12px}.professor-user-chip{font-size:13px;color:#555;background:#f5f5f5;border-radius:30px;padding:9px 13px}
.professor-layout{display:grid;grid-template-columns:248px minmax(0,1fr);min-height:calc(100vh - 68px)}
.professor-sidebar{background:#fff;border-right:1px solid #e7e7e7;padding:26px 16px;display:flex;flex-direction:column;gap:7px}
.professor-nav-title{font-size:10px;font-weight:800;letter-spacing:.13em;color:#9a9a9a;padding:0 12px 12px}
.professor-nav-button{border:0;background:transparent;text-align:left;padding:12px;border-radius:10px;display:flex;align-items:center;gap:11px;color:#555;font:inherit;font-size:14px;cursor:pointer}
.professor-nav-button:hover{background:#f8f4e9;color:#171717}.professor-nav-button.active{background:#fff4d6;color:#805400;font-weight:700}
.professor-nav-icon{width:25px;height:25px;display:grid;place-items:center;border-radius:7px;background:#f3f3f3;font-weight:700}.professor-nav-button.active .professor-nav-icon{background:#f6df9f}
.professor-sidebar-note{margin-top:auto;padding:14px 12px;color:#999;font-size:11px;border-top:1px solid #eee}
.professor-main{padding:34px;max-width:1200px;width:100%;margin:0 auto}.professor-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:26px}.professor-eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;color:#9a6b12;margin:0 0 8px}.professor-heading h1{font-size:28px;line-height:1.2;margin:0 0 8px}.professor-heading p{color:#777;margin:0;font-size:14px}.professor-campus{font-size:11px;font-weight:800;letter-spacing:.08em;color:#805400;background:#fff0c7;border-radius:20px;padding:9px 13px}
.professor-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;margin-bottom:22px}.professor-card{background:#fff;border:1px solid #e9e9e9;border-radius:14px;padding:20px;box-shadow:0 2px 8px #00000005}.professor-stat-label{font-size:12px;color:#777}.professor-stat-value{font-size:28px;font-weight:800;margin-top:8px}.professor-card h2{font-size:16px;margin:0 0 14px}.professor-card p{font-size:13px;line-height:1.6;color:#666}.professor-section{margin-bottom:18px}
.professor-list{display:flex;flex-direction:column;gap:10px}.professor-list-item{border:1px solid #eee;border-radius:11px;padding:14px;display:flex;justify-content:space-between;gap:15px;align-items:center}.professor-list-item strong{font-size:14px}.professor-muted{font-size:12px;color:#888;margin-top:4px}.professor-pill{display:inline-flex;background:#f4f4f4;border-radius:20px;padding:5px 9px;font-size:11px;color:#666;white-space:nowrap}
.professor-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.professor-field{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:#555}.professor-field.full{grid-column:1/-1}.professor-field input,.professor-field select,.professor-field textarea{width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:9px;padding:11px 12px;background:#fff;color:#222;font:inherit;font-size:13px}.professor-field textarea{min-height:90px;resize:vertical}
.professor-button{border:0;border-radius:9px;padding:11px 15px;background:#e9a900;color:#171717;font:inherit;font-size:13px;font-weight:800;cursor:pointer}.professor-button:disabled{opacity:.55;cursor:not-allowed}.professor-button.secondary{background:#f0f0f0;color:#444}.professor-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
.professor-feedback{padding:11px 13px;border-radius:9px;background:#fff5d9;color:#775000;font-size:13px;margin:0 0 16px}.professor-empty{padding:24px;text-align:center;color:#888;border:1px dashed #ddd;border-radius:12px;font-size:13px}.professor-status{padding:15px;border-radius:11px;background:#fff5d9;color:#765000;font-size:13px;line-height:1.6}
.professor-doc-title{font-size:14px;font-weight:700}.professor-file-meta{font-size:11px;color:#888;margin-top:5px}
@media(max-width:850px){.professor-layout{grid-template-columns:1fr}.professor-sidebar{position:sticky;top:68px;z-index:4;flex-direction:row;overflow-x:auto;padding:9px;border-right:0;border-bottom:1px solid #e7e7e7}.professor-nav-title,.professor-sidebar-note{display:none}.professor-nav-button{white-space:nowrap;padding:9px 11px;font-size:12px}.professor-main{padding:22px 16px}.professor-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.professor-topbar{padding:0 14px;height:60px}.professor-layout{min-height:calc(100vh - 60px)}.professor-sidebar{top:60px}.professor-user-chip{display:none}.professor-heading h1{font-size:23px}.professor-grid{grid-template-columns:1fr 1fr;gap:9px}.professor-card{padding:14px}.professor-stat-value{font-size:23px}.professor-form{grid-template-columns:1fr}.professor-field.full{grid-column:auto}.professor-list-item{align-items:flex-start;flex-direction:column}}
`;

function dateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

export default function ProfessorShell({ token, user, onLogout, request }) {
  const [active, setActive] = useState("home");
  const [assignments, setAssignments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [file, setFile] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      request("/professor/assignments", { token }),
      request("/class-documents", { token }),
      request("/notifications", { token })
    ]);
    if (results[0].status === "fulfilled") setAssignments(results[0].value.data || []);
    else setAssignments([]);
    if (results[1].status === "fulfilled") setDocuments(results[1].value.data || []);
    else setDocuments([]);
    if (results[2].status === "fulfilled") setNotifications(results[2].value.data || []);
    else setNotifications([]);
    setLoading(false);
  }, [request, token]);

  useEffect(() => { load(); }, [load]);

  const courses = useMemo(() => {
    const seen = new Set();
    return assignments.filter(item => item.course_id && item.course_name && !seen.has(String(item.course_id)) && seen.add(String(item.course_id)));
  }, [assignments]);
  const unread = notifications.filter(item => !item.read_at).length;
  const pageTitle = {
    home: ["Vue d’ensemble", "Suivez vos affectations et accédez rapidement à vos outils pédagogiques."],
    courses: ["Mes cours", "Consultez les cours qui vous ont été attribués par un responsable habilité."],
    documents: ["Documents pédagogiques", "Publiez et consultez les ressources des cours auxquels vous êtes affecté."],
    notifications: ["Notifications", "Les informations et mises à jour liées à votre activité pédagogique."],
    profile: ["Mon profil", "Informations de votre compte professeur."]
  }[active];

  async function publishDocument(event) {
    event.preventDefault();
    if (!file || !courseId) { setFeedback("Choisissez un cours et un fichier PDF."); return; }
    if (file.type !== "application/pdf" || file.size > 25 * 1024 * 1024) {
      setFeedback("Le fichier doit être un PDF valide de 25 Mo maximum."); return;
    }
    const course = courses.find(item => String(item.course_id) === String(courseId));
    if (!course) { setFeedback("Ce cours ne figure plus dans vos affectations actives."); return; }
    const form = new FormData();
    form.append("title", title.trim());
    form.append("course", course.course_name);
    form.append("courseId", String(course.course_id));
    form.append("professor", [user.firstName, user.lastName].filter(Boolean).join(" "));
    form.append("description", description.trim());
    form.append("file", file);
    setBusy(true); setFeedback("");
    try {
      const result = await request("/class-documents", { token, method: "POST", body: form });
      setTitle(""); setDescription(""); setFile(null); setCourseId("");
      const input = document.getElementById("professor-pdf-file");
      if (input) input.value = "";
      setFeedback(result.message || "Document publié dans le cours attribué.");
      await load();
    } catch (error) { setFeedback(error.message || "La publication a échoué."); }
    finally { setBusy(false); }
  }

  async function markRead(id) {
    try {
      await request(`/notifications/${id}/read`, { token, method: "PATCH" });
      setNotifications(rows => rows.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    } catch (error) { setFeedback(error.message); }
  }

  async function downloadDocument(id, name) {
    try {
      const response = await fetch(`/api/v1/class-documents/${id}/download`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || result.error || "Téléchargement impossible.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = name || `document-${id}.pdf`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) { setFeedback(error.message); }
  }

  return <main className="professor-app">
    <style>{styles}</style>
    <header className="professor-topbar">
      <a className="professor-brand" href="#professeur-accueil" onClick={event => { event.preventDefault(); setActive("home"); }}>
        <img src="/ifac-logo.svg" alt="" /><span>iFac <span>universite</span></span>
      </a>
      <div className="professor-top-actions">
        <span className="professor-user-chip">{user.firstName} {user.lastName}</span>
        <button className="professor-button secondary" type="button" onClick={onLogout}>Déconnexion</button>
      </div>
    </header>
    <div className="professor-layout">
      <aside className="professor-sidebar" aria-label="Navigation de l’espace professeur">
        <p className="professor-nav-title">ESPACE PROFESSEUR</p>
        {tabs.map(tab => <button key={tab.id} type="button" className={active === tab.id ? "professor-nav-button active" : "professor-nav-button"} onClick={() => setActive(tab.id)}>
          <span className="professor-nav-icon" aria-hidden="true">{tab.icon}</span>{tab.label}
          {tab.id === "notifications" && unread > 0 && <span className="professor-pill">{unread}</span>}
        </button>)}
        <div className="professor-sidebar-note">Un espace dédié à vos activités pédagogiques.</div>
      </aside>
      <section className="professor-main" aria-live="polite">
        <div className="professor-heading">
          <div><p className="professor-eyebrow">iFAC UNIVERSITÉ · ENSEIGNEMENT</p><h1>{pageTitle[0]}</h1><p>{pageTitle[1]}</p></div>
          <span className="professor-campus">PROFESSEUR</span>
        </div>
        {feedback && <p className="professor-feedback" role="status">{feedback}</p>}
        {loading ? <div className="professor-empty">Chargement de votre espace professeur…</div> : <>
          {active === "home" && <>
            {!courses.length && <div className="professor-status professor-section">Votre compte professeur est créé, mais aucune affectation de cours active n’est encore associée. Un responsable habilité doit vous attribuer un cours avant que vous puissiez publier des documents.</div>}
            <div className="professor-grid">
              <article className="professor-card"><div className="professor-stat-label">Cours attribués</div><div className="professor-stat-value">{courses.length}</div></article>
              <article className="professor-card"><div className="professor-stat-label">Documents pédagogiques</div><div className="professor-stat-value">{documents.length}</div></article>
              <article className="professor-card"><div className="professor-stat-label">Notifications non lues</div><div className="professor-stat-value">{unread}</div></article>
            </div>
            <section className="professor-card professor-section"><h2>Mes cours récents</h2>
              {courses.length ? <div className="professor-list">{courses.slice(0,4).map(item => <div className="professor-list-item" key={item.course_id}><div><strong>{item.course_name}</strong><div className="professor-muted">{item.faculty_name} · {item.option_name} · {item.level_label}</div></div><span className="professor-pill">Affectation active</span></div>)}</div> : <p>Aucun cours à afficher pour le moment.</p>}
            </section>
            <section className="professor-card"><h2>Accès rapide</h2><div className="professor-actions"><button className="professor-button" onClick={() => setActive("courses")}>Voir mes cours</button><button className="professor-button secondary" onClick={() => setActive("documents")}>Gérer mes documents</button></div></section>
          </>}
          {active === "courses" && <section className="professor-card"><h2>Mes affectations pédagogiques</h2>
            {assignments.length ? <div className="professor-list">{assignments.map((item,index) => <div className="professor-list-item" key={item.course_id ? `${item.course_id}-${index}` : index}><div><strong>{item.course_name || "Affectation de niveau"}</strong><div className="professor-muted">{item.university_name} · {item.faculty_name} · {item.option_name} · {item.level_label}</div></div><span className="professor-pill">{item.course_id ? "Cours actif" : "Niveau attribué"}</span></div>)}</div> : <div className="professor-empty">Aucune affectation active. Contactez le responsable de programme de votre parcours.</div>}
          </section>}
          {active === "documents" && <>
            <section className="professor-card professor-section"><h2>Publier un document dans un cours</h2>
              {!courses.length ? <div className="professor-empty">La publication sera disponible après l’attribution d’au moins un cours.</div> : <form className="professor-form" onSubmit={publishDocument}>
                <label className="professor-field full">Cours attribué<select required value={courseId} onChange={event => setCourseId(event.target.value)}><option value="">Sélectionner un cours</option>{courses.map(item => <option key={item.course_id} value={item.course_id}>{item.course_name} · {item.option_name} · {item.level_label}</option>)}</select></label>
                <label className="professor-field full">Titre du document<input required maxLength="220" value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex. : Support du chapitre 1" /></label>
                <label className="professor-field full">Description<textarea maxLength="3000" value={description} onChange={event => setDescription(event.target.value)} placeholder="Précisez le contenu ou les objectifs pédagogiques (facultatif)." /></label>
                <label className="professor-field full">Fichier PDF (25 Mo maximum)<input id="professor-pdf-file" type="file" accept="application/pdf,.pdf" required onChange={event => setFile(event.target.files?.[0] || null)} /></label>
                <div className="professor-field full"><div className="professor-actions"><button className="professor-button" type="submit" disabled={busy}>{busy ? "Publication en cours…" : "Publier le document"}</button><span className="professor-muted">Le document sera visible dans le périmètre du cours sélectionné.</span></div></div>
              </form>}
            </section>
            <section className="professor-card"><h2>Documents déjà publiés</h2>
              {documents.length ? <div className="professor-list">{documents.map(item => <div className="professor-list-item" key={item.id}><div><div className="professor-doc-title">{item.title}</div><div className="professor-muted">{item.course || "Cours"} · {dateLabel(item.created_at)} · {item.file_name || "PDF"}</div>{item.description && <div className="professor-file-meta">{item.description}</div>}</div><button className="professor-button secondary" onClick={() => downloadDocument(item.id,item.file_name)}>Télécharger</button></div>)}</div> : <div className="professor-empty">Aucun document publié ou accessible dans vos cours.</div>}
            </section>
          </>}
          {active === "notifications" && <section className="professor-card"><h2>Vos notifications</h2>
            {notifications.length ? <div className="professor-list">{notifications.map(item => <div className="professor-list-item" key={item.id}><div><strong>{item.title || item.message || "Mise à jour pédagogique"}</strong><div className="professor-muted">{dateLabel(item.created_at)}{item.read_at ? " · Lue" : " · Non lue"}</div></div>{!item.read_at && <button className="professor-button secondary" onClick={() => markRead(item.id)}>Marquer comme lue</button>}</div>)}</div> : <div className="professor-empty">Aucune notification pour le moment.</div>}
          </section>}
          {active === "profile" && <section className="professor-card">
            <h2>Identité du compte</h2>
            <div className="professor-list">
              <div className="professor-list-item"><div><div className="professor-muted">Nom complet</div><strong>{user.firstName} {user.lastName}</strong></div><span className="professor-pill">Professeur</span></div>
              <div className="professor-list-item"><div><div className="professor-muted">Adresse e-mail</div><strong>{user.email}</strong></div></div>
              <div className="professor-list-item"><div><div className="professor-muted">Affectations actives</div><strong>{assignments.length}</strong></div></div>
            </div>
            <p>Les informations de parcours sont déterminées par les affectations validées par les responsables habilités.</p>
          </section>}
        </>}
      </section>
    </div>
  </main>;
}
