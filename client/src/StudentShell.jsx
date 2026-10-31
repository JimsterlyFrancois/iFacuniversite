import { useEffect, useState } from "react";

const destinations = [
  { id: "class", label: "Annonces", short: "Infos" },
  { id: "classDocs", label: "Documents de classe", short: "Cours" },
  { id: "notifications", label: "Notifications", short: "Alertes" },
  { id: "classAdmin", label: "Gestion des classes", short: "Gestion", adminOnly: true },
  { id: "messages", label: "Messagerie", short: "Messages" },
  { id: "home", label: "Documents", short: "Documents" },
  { id: "notes", label: "Notes privées", short: "Notes" },
  { id: "profile", label: "Profil", short: "Profil" }
];

export default function StudentShell({ token, user, onLogout, request }) {
  const [active, setActive] = useState("home");
  const [dark, setDark] = useState(true);
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [messages, setMessages] = useState([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [adminCatalog, setAdminCatalog] = useState({ faculties: [], options: [], levels: [] });
  const [classList, setClassList] = useState([]);
  const [selectedClassKey, setSelectedClassKey] = useState("");
  const [classStudents, setClassStudents] = useState([]);
  const [classDocuments, setClassDocuments] = useState([]);
  const [pendingClassDocuments, setPendingClassDocuments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [classDocTitle, setClassDocTitle] = useState("");
  const [classDocCourse, setClassDocCourse] = useState("");
  const [classDocProfessor, setClassDocProfessor] = useState("");
  const [classDocDescription, setClassDocDescription] = useState("");
  const [adminFacultyId, setAdminFacultyId] = useState("");
  const [adminOptionId, setAdminOptionId] = useState("");
  const [adminLevelId, setAdminLevelId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [groupType, setGroupType] = useState("faculty");
  const [feedbackCategory, setFeedbackCategory] = useState("suggestion");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const page = destinations.find(x => x.id === active);

  async function load() {
    setBusy(true); setFeedback("");
    try {
      if (active === "home") { const r = await request("/documents", { token }); setItems(r.data || []); }
      if (active === "class") { const r = await request("/announcements", { token }); setItems(r.data || []); }
      if (active === "notes") { const r = await request("/notes", { token }); setItems(r.data || []); }
      if (active === "classDocs") { const r = await request("/class-documents", { token }); setClassDocuments(r.data || []); }
      if (active === "notifications") { const r = await request("/notifications", { token }); setNotifications(r.data || []); }
      if (active === "classAdmin" && user.role === "admin") {
        const [classesResult, pendingResult] = await Promise.all([
          request("/admin/classes", { token }), request("/admin/class-documents?status=pending", { token })
        ]);
        setClassList(classesResult.data || []);
        setPendingClassDocuments(pendingResult.data || []);
        const chosen = (classesResult.data || []).find(c => [c.university_id,c.faculty_id,c.option_id,c.study_level_id].join(":") === selectedClassKey) || (classesResult.data || [])[0];
        if (chosen) {
          const key = [chosen.university_id,chosen.faculty_id,chosen.option_id,chosen.study_level_id].join(":");
          if (key !== selectedClassKey) setSelectedClassKey(key);
          const students = await request(`/admin/classes/${key.replaceAll(":", "/")}/students`, { token });
          setClassStudents(students.data || []);
        } else { setClassStudents([]); }
      }
      if (active === "messages") {
        const r = await request("/messages/groups", { token }); setGroups(r.data || []);
        if (selectedGroup && (r.data || []).some(g => String(g.id) === String(selectedGroup))) {
          const m = await request(`/messages/groups/${selectedGroup}`, { token }); setMessages(m.data || []);
        } else { setMessages([]); if (r.data?.length) setSelectedGroup(String(r.data[0].id)); }
      }
      if (active === "profile") {
        if (user.role === "admin") {
          const [overview, subjectResult, catalog] = await Promise.all([request("/admin/overview", { token }), request("/admin/subjects", { token }), request("/admin/catalog", { token })]);
          setAdminStats(overview.data); setSubjects(subjectResult.data || []);
          setAdminCatalog(catalog.data || { faculties: [], options: [], levels: [] });
        }
      }
    } catch (e) { setFeedback(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [active, selectedGroup, selectedClassKey]);
  async function saveNote(e) {
    e.preventDefault(); setBusy(true); setFeedback("");
    try { await request("/notes", { token, method: "POST", body: JSON.stringify({ title: noteTitle, body: noteBody }) }); setNoteTitle(""); setNoteBody(""); await load(); setFeedback("Note enregistrée."); }
    catch (e) { setFeedback(e.message); } finally { setBusy(false); }
  }
  async function uploadDocument(e) {
    e.preventDefault(); const formElement = e.currentTarget; const form = new FormData(formElement); setBusy(true); setFeedback("");
    try { await request("/admin/documents", { token, method: "POST", body: form }); formElement.reset(); setFeedback("Document ajouté à la bibliothèque."); }
    catch (err) { setFeedback(err.message); } finally { setBusy(false); }
  }
  async function uploadClassDocument(e) {
    e.preventDefault(); const formElement = e.currentTarget; const form = new FormData(formElement);
    setBusy(true); setFeedback("");
    try {
      const result = await request("/class-documents", { token, method: "POST", body: form });
      setClassDocTitle(""); setClassDocCourse(""); setClassDocProfessor(""); setClassDocDescription("");
      formElement.reset(); setFeedback(result.message || "Document envoyé pour validation.");
    } catch (error) { setFeedback(error.message); } finally { setBusy(false); }
  }
  async function assignDelegate(userId) {
    if (!selectedClassKey) return;
    setBusy(true); setFeedback("");
    try { await request(`/admin/classes/${selectedClassKey.replaceAll(":", "/")}/delegates`, { token, method: "POST", body: JSON.stringify({ userId }) }); setFeedback("Délégué désigné."); await load(); }
    catch (error) { setFeedback(error.message === "delegate_limit_reached" ? "Cette classe possède déjà trois délégués." : error.message); }
    finally { setBusy(false); }
  }
  async function removeDelegate(userId) {
    if (!selectedClassKey) return;
    setBusy(true); setFeedback("");
    try { await request(`/admin/classes/${selectedClassKey.replaceAll(":", "/")}/delegates/${userId}`, { token, method: "DELETE" }); setFeedback("Rôle de délégué retiré."); await load(); }
    catch (error) { setFeedback(error.message); } finally { setBusy(false); }
  }
  async function reviewClassDocument(id, status) {
    const reason = status === "rejected" ? window.prompt("Motif du refus (obligatoire) :") : "";
    if (status === "rejected" && !reason?.trim()) return;
    setBusy(true); setFeedback("");
    try { await request(`/admin/class-documents/${id}/review`, { token, method: "POST", body: JSON.stringify({ status, reason }) }); setFeedback(status === "approved" ? "Document approuvé et classe notifiée." : "Document refusé."); await load(); }
    catch (error) { setFeedback(error.message); } finally { setBusy(false); }
  }
  async function markNotificationRead(id) {
    try { await request(`/notifications/${id}/read`, { token, method: "PATCH" }); setNotifications(rows => rows.map(row => row.id === id ? { ...row, read_at: new Date().toISOString() } : row)); }
    catch (error) { setFeedback(error.message); }
  }
  async function downloadClassDocument(id, name) {
    try {
      const response = await fetch(`/api/v1/class-documents/${id}/download`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || data.error || "Téléchargement impossible."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = name || `document-${id}.pdf`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (error) { setFeedback(error.message); }
  }
  async function deleteNote(id) {
    if (!window.confirm("Supprimer cette note privée ?")) return;
    try { await request(`/notes/${id}`, { token, method: "DELETE" }); await load(); }
    catch (e) { setFeedback(e.message); }
  }
  async function createSubject(e) {
    e.preventDefault(); setBusy(true); setFeedback("");
    try { await request("/admin/subjects", { token, method: "POST", body: JSON.stringify({ optionId: adminOptionId, studyLevelId: adminLevelId, name: subjectName }) }); setSubjectName(""); setFeedback("Matière créée."); await load(); }
    catch (e) { setFeedback(e.message); } finally { setBusy(false); }
  }
  async function createAnnouncement(e) {
    e.preventDefault(); setBusy(true); setFeedback("");
    try { await request("/admin/announcements", { token, method: "POST", body: JSON.stringify({ title: announcementTitle, body: announcementBody }) }); setAnnouncementTitle(""); setAnnouncementBody(""); setFeedback("Annonce publiée."); await load(); }
    catch (e) { setFeedback(e.message); } finally { setBusy(false); }
  }
  async function createGroup(e) {
    e.preventDefault(); setBusy(true); setFeedback("");
    const body = { groupType, facultyId: user.facultyId, optionId: groupType === "faculty" ? null : user.optionId, studyLevelId: groupType === "class" ? user.studyLevelId : null };
    try { await request("/admin/groups", { token, method: "POST", body: JSON.stringify(body) }); setFeedback("Groupe créé et membres correspondants ajoutés."); await load(); }
    catch (e) { setFeedback(e.message); } finally { setBusy(false); }
  }
  async function submitFeedback(e) {
    e.preventDefault(); setBusy(true); setFeedback("");
    try { const result = await request("/feedback", { token, method: "POST", body: JSON.stringify({ category: feedbackCategory, message: feedbackMessage }) }); setFeedback(result.message || "Avis envoyé."); setFeedbackMessage(""); }
    catch (e) { setFeedback(e.message); } finally { setBusy(false); }
  }
  async function deleteDocument(id) {
    if (!window.confirm("Retirer ce document de la bibliothèque ?")) return;
    try { await request("/admin/documents/" + id, { token, method: "DELETE" }); await load(); setFeedback("Document retiré."); }
    catch (e) { setFeedback(e.message); }
  }
  async function sendMessage(e) {
    e.preventDefault(); if (!selectedGroup) return;
    try { await request(`/messages/groups/${selectedGroup}`, { token, method: "POST", body: JSON.stringify({ body: messageBody }) }); setMessageBody(""); await load(); }
    catch (e) { setFeedback(e.message); }
  }
  async function downloadDocument(id, title) {
    try {
      const response = await fetch(`/api/v1/documents/${id}/download`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { const r = await response.json().catch(() => ({})); throw new Error(r.message || r.error || "Téléchargement impossible."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = title || `document-${id}`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { setFeedback(e.message); }
  }

  const headings = { home: ["Bibliothèque documentaire", "Documents disponibles pour votre option et votre niveau."], class: ["Annonces", "Informations publiées pour votre parcours."], classDocs: ["Documents de classe", "Partagez les supports de cours et consultez les documents validés."], notifications: ["Notifications", "Les nouvelles ressources approuvées pour votre classe."], classAdmin: ["Gestion des classes", "Désignez les délégués et validez les documents partagés."], messages: ["Messagerie", "Messages des groupes auxquels votre compte appartient."], notes: ["Mes notes privées", "Ces notes ne sont accessibles qu’à votre compte."], profile: ["Mon profil", "Informations du compte et état des services."] };
  const visibleDestinations = destinations.filter(x => !x.adminOnly || user.role === "admin");
  return <main className={dark ? "student-app student-dark" : "student-app student-light"}>
    <header className="student-topbar"><a className="brand" href="#accueil" onClick={e => {e.preventDefault();setActive("home");}}><span className="brand-mark">iF</span><span>iFac <span className="brand-light">universite</span></span></a><div className="student-top-actions"><span className="preview-pill">{user.firstName} {user.lastName}</span><button className="subtle-button" onClick={onLogout}>Déconnexion</button></div></header>
    <div className="student-body"><aside className="student-sidebar" aria-label="Navigation principale"><p className="student-nav-caption">ESPACE ÉTUDIANT</p>{visibleDestinations.map(x => <button key={x.id} className={active === x.id ? "student-nav-item selected" : "student-nav-item"} onClick={() => setActive(x.id)}><span className={"nav-symbol nav-symbol-" + x.id}>{x.short[0]}</span><span>{x.label}</span></button>)}<div className="student-sidebar-note">UPNCH au lancement</div></aside>
      <section className="student-main" aria-live="polite"><div className="student-welcome"><div><p className="student-eyebrow">ESPACE UNIVERSITAIRE</p><h1>{headings[active][0]}</h1><p>{headings[active][1]}</p></div><span className="student-campus-badge">UPNCH</span></div>
        {active === "profile" && <section className="student-card profile-preferences"><div><h2>Préférences d’affichage</h2><p>Choisissez l’apparence de l’interface.</p></div><button className="theme-button" onClick={() => setDark(v => !v)}>{dark ? "Thème clair" : "Thème sombre"}</button><p><strong>Compte :</strong> {user.email}</p><p><strong>Rôle :</strong> {user.role}</p>{adminStats && <p>Administration — utilisateurs : {adminStats.users} · documents : {adminStats.documents} · annonces : {adminStats.announcements}</p>}{user.role === "admin" && <form className="student-card note-form" onSubmit={uploadDocument}><h2>Ajouter un document PDF</h2><label className="field">Matière<select name="subjectId" required defaultValue=""><option value="">Choisir la matière</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name} — {s.option_name} / {s.level_label}</option>)}</select></label><label className="field">Titre<input name="title" maxLength="220" required /></label><label className="field">Fichier PDF<input name="file" type="file" accept="application/pdf,.pdf" required /></label><p>PDF uniquement, 15 Mo maximum. Les fichiers restent dans le stockage privé du serveur.</p><button className="theme-button" disabled={busy}>Téléverser le document</button></form>}
          {user.role === "admin" && <form className="student-card note-form" onSubmit={createSubject}>
            <h2>Créer une matière</h2>
            <label className="field">Faculté<select required value={adminFacultyId} onChange={e => { setAdminFacultyId(e.target.value); setAdminOptionId(""); setAdminLevelId(""); }}><option value="">Choisir la faculté</option>{adminCatalog.faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
            <label className="field">Option<select required value={adminOptionId} onChange={e => { setAdminOptionId(e.target.value); setAdminLevelId(""); }} disabled={!adminFacultyId}><option value="">Choisir l’option</option>{adminCatalog.options.filter(o => String(o.faculty_id) === String(adminFacultyId)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
            <label className="field">Niveau<select required value={adminLevelId} onChange={e => setAdminLevelId(e.target.value)} disabled={!adminOptionId}><option value="">Choisir le niveau</option>{adminCatalog.levels.filter(l => String(l.option_id) === String(adminOptionId)).map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
            <label className="field">Nom de la matière<input value={subjectName} onChange={e => setSubjectName(e.target.value)} maxLength="180" required /></label>
            <button className="theme-button" disabled={busy}>Créer la matière</button>
          </form>}
          {user.role === "admin" && <form className="student-card note-form" onSubmit={createAnnouncement}>
            <h2>Publier une annonce générale</h2><label className="field">Titre<input value={announcementTitle} onChange={e => setAnnouncementTitle(e.target.value)} maxLength="220" required /></label>
            <label className="field">Message<textarea value={announcementBody} onChange={e => setAnnouncementBody(e.target.value)} maxLength="20000" rows="4" required /></label>
            <button className="theme-button" disabled={busy}>Publier l’annonce</button>
          </form>}
          {user.role === "admin" && <form className="student-card note-form" onSubmit={createGroup}>
            <h2>Créer un groupe de messagerie</h2><label className="field">Portée du groupe<select value={groupType} onChange={e => setGroupType(e.target.value)}><option value="faculty">Toute ma faculté</option><option value="option">Mon option</option><option value="class">Mon niveau</option></select></label>
            <p>Les étudiants correspondant à votre profil seront ajoutés automatiquement.</p><button className="theme-button" disabled={busy}>Créer le groupe</button>
          </form>}
          <form className="student-card note-form" onSubmit={submitFeedback}>
            <h2>Envoyer un avis à l’équipe iFac</h2><label className="field">Type d’avis<select value={feedbackCategory} onChange={e => setFeedbackCategory(e.target.value)}><option value="suggestion">Suggestion</option><option value="question">Question</option><option value="rating">Évaluation</option></select></label>
            <label className="field">Votre message<textarea value={feedbackMessage} onChange={e => setFeedbackMessage(e.target.value)} maxLength="5000" rows="3" required /></label>
            <button className="theme-button" disabled={busy}>Envoyer l’avis</button>
          </form>
        </section>}
        {active === "classDocs" && <><form className="student-card note-form" onSubmit={uploadClassDocument}><h2>Partager un document avec votre classe</h2><label className="field">Titre du document<input value={classDocTitle} onChange={e => setClassDocTitle(e.target.value)} name="title" maxLength="220" required /></label><label className="field">Cours / matière<input value={classDocCourse} onChange={e => setClassDocCourse(e.target.value)} name="course" maxLength="180" required /></label><label className="field">Professeur<input value={classDocProfessor} onChange={e => setClassDocProfessor(e.target.value)} name="professor" maxLength="180" /></label><label className="field">Description<textarea value={classDocDescription} onChange={e => setClassDocDescription(e.target.value)} name="description" maxLength="3000" rows="3" /></label><label className="field">Fichier PDF<input name="file" type="file" accept="application/pdf,.pdf" required /></label><p>PDF uniquement, 25 Mo maximum. Le document sera visible après validation de l’administrateur.</p><button className="theme-button" disabled={busy}>Envoyer pour validation</button></form><section className="student-card student-data-list"><h2>Documents approuvés pour ma classe</h2>{classDocuments.length === 0 ? <p>Aucun document approuvé pour le moment.</p> : classDocuments.map(item => <article className="student-data-item" key={item.id}><strong>{item.title}</strong><p>{item.course} {item.professor ? `· ${item.professor}` : ""}</p>{item.description && <p>{item.description}</p>}<button className="theme-button" onClick={() => downloadClassDocument(item.id,item.file_name)}>Télécharger</button></article>)}</section></>}
        {active === "notifications" && <section className="student-card student-data-list"><h2>Mes notifications</h2>{notifications.length === 0 ? <p>Aucune notification pour le moment.</p> : notifications.map(item => <article className="student-data-item" key={item.id}><strong>{item.title}</strong><p>Un document a été approuvé pour le cours : {item.course}</p><small>{new Date(item.created_at).toLocaleString()} · {item.read_at ? "Lue" : "Non lue"}</small>{!item.read_at && <button className="theme-button" onClick={() => markNotificationRead(item.id)}>Marquer comme lue</button>}</article>)}</section>}
        {active === "classAdmin" && user.role === "admin" && <><section className="student-card note-form"><h2>Classes de l’université</h2><label className="field">Sélectionner une classe<select value={selectedClassKey} onChange={e => setSelectedClassKey(e.target.value)}><option value="">Choisir une classe</option>{classList.map(c => { const key = [c.university_id,c.faculty_id,c.option_id,c.study_level_id].join(":"); return <option key={key} value={key}>{c.faculty_name} · {c.option_name} · {c.study_level_label}</option>; })}</select></label>{classList.find(c => [c.university_id,c.faculty_id,c.option_id,c.study_level_id].join(":") === selectedClassKey) && <p>Étudiants : {classList.find(c => [c.university_id,c.faculty_id,c.option_id,c.study_level_id].join(":") === selectedClassKey).student_count} · Délégués : {classList.find(c => [c.university_id,c.faculty_id,c.option_id,c.study_level_id].join(":") === selectedClassKey).delegate_count} / 3</p>}</section><section className="student-card student-data-list"><h2>Étudiants et délégués</h2>{classStudents.length === 0 ? <p>Aucun étudiant trouvé pour cette classe.</p> : classStudents.map(student => <article className="student-data-item" key={student.id}><strong>{student.first_name} {student.last_name}</strong><p>{student.email} · {student.role}</p>{student.role === "delegate" ? <button className="theme-button" onClick={() => removeDelegate(student.id)} disabled={busy}>Retirer le rôle</button> : <button className="theme-button" onClick={() => assignDelegate(student.id)} disabled={busy || (classList.find(c => [c.university_id,c.faculty_id,c.option_id,c.study_level_id].join(":") === selectedClassKey)?.delegate_count || 0) >= 3}>Désigner délégué</button>}</article>)}</section><section className="student-card student-data-list"><h2>Documents en attente de validation</h2>{pendingClassDocuments.length === 0 ? <p>Aucun document en attente.</p> : pendingClassDocuments.map(doc => <article className="student-data-item" key={doc.id}><strong>{doc.title}</strong><p>{doc.course} · {doc.uploader_first_name} {doc.uploader_last_name}</p><small>{doc.faculty_name} · {doc.option_name} · {doc.study_level_label}</small><div className="admin-review-actions"><button className="theme-button" onClick={() => downloadClassDocument(doc.id,doc.file_name)}>Consulter le PDF</button><button className="theme-button" onClick={() => reviewClassDocument(doc.id,"approved")} disabled={busy}>Approuver</button><button className="theme-button" onClick={() => reviewClassDocument(doc.id,"rejected")} disabled={busy}>Refuser</button></div></article>)}</section></>}
        {active === "notes" && <form className="student-card note-form" onSubmit={saveNote}><h2>Ajouter une note</h2><input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Titre de la note" maxLength="180" required /><textarea value={noteBody} onChange={e => setNoteBody(e.target.value)} placeholder="Écrire votre note privée…" maxLength="50000" rows="4" /><button className="theme-button" disabled={busy}>Enregistrer la note</button></form>}
        {active === "messages" && groups.length > 0 && <div className="student-card"><label>Groupe <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>{groups.map(g => <option key={g.id} value={g.id}>Groupe {g.id} · {g.group_type}</option>)}</select></label><div className="student-data-list">{messages.map(m => <article className="student-data-item" key={m.id}><strong>{m.first_name} {m.last_name}</strong><p>{m.body}</p><small>{new Date(m.created_at).toLocaleString()}</small></article>)}</div><form onSubmit={sendMessage}><textarea value={messageBody} onChange={e => setMessageBody(e.target.value)} placeholder="Votre message…" maxLength="5000" required /><button className="theme-button">Envoyer</button></form></div>}
        {busy && <p role="status">Chargement…</p>}{feedback && <p className="form-feedback" role="status">{feedback}</p>}
        {active !== "profile" && active !== "notes" && active !== "messages" && <section className="student-card student-data-list">{items.length === 0 && !busy ? <p>Aucun élément disponible pour le moment.</p> : items.map(item => <article className="student-data-item" key={item.id}><strong>{item.title}</strong>{item.subject && <p>Matière : {item.subject}</p>}<p>{item.body || (item.mime_type ? `${item.mime_type} · ${Math.round(Number(item.file_size_bytes || 0)/1024)} Ko` : "")}</p><small>{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</small>{active === "home" && <><button className="theme-button" onClick={() => downloadDocument(item.id, item.title)}>Télécharger</button>{user.role === "admin" && <button className="theme-button" onClick={() => deleteDocument(item.id)}>Retirer le document</button>}</>}</article>)}</section>}
        {active === "notes" && <section className="student-card student-data-list">{items.length === 0 && !busy ? <p>Aucune note enregistrée.</p> : items.map(item => <article className="student-data-item" key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>Modifiée : {new Date(item.updated_at).toLocaleString()}</small><button className="theme-button" onClick={() => deleteNote(item.id)}>Supprimer</button></article>)}</section>}
        {active === "messages" && groups.length === 0 && !busy && <section className="student-card"><p>Aucun groupe de messagerie ne vous est encore attribué.</p></section>}
      </section></div>
    <nav className="student-mobile-nav" aria-label="Navigation mobile">{visibleDestinations.map(x => <button key={x.id} className={active === x.id ? "mobile-nav-item selected" : "mobile-nav-item"} onClick={() => setActive(x.id)}><span className={"mobile-nav-symbol nav-symbol-" + x.id}>{x.short[0]}</span><span>{x.short}</span></button>)}</nav>
  </main>;
}
