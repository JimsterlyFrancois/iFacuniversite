import { useEffect, useState } from "react";

const destinations = [
  { id: "class", label: "Annonces", short: "Classe" },
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
  const page = destinations.find(x => x.id === active);

  async function load() {
    setBusy(true); setFeedback("");
    try {
      if (active === "home") { const r = await request("/documents", { token }); setItems(r.data || []); }
      if (active === "class") { const r = await request("/announcements", { token }); setItems(r.data || []); }
      if (active === "notes") { const r = await request("/notes", { token }); setItems(r.data || []); }
      if (active === "messages") {
        const r = await request("/messages/groups", { token }); setGroups(r.data || []);
        if (selectedGroup && (r.data || []).some(g => String(g.id) === String(selectedGroup))) {
          const m = await request(`/messages/groups/${selectedGroup}`, { token }); setMessages(m.data || []);
        } else { setMessages([]); if (r.data?.length) setSelectedGroup(String(r.data[0].id)); }
      }
      if (active === "profile") {
        if (user.role === "admin") { const r = await request("/admin/overview", { token }); setAdminStats(r.data); const s = await request("/admin/subjects", { token }); setSubjects(s.data || []); }
      }
    } catch (e) { setFeedback(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [active, selectedGroup]);
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
  async function deleteNote(id) {
    if (!window.confirm("Supprimer cette note privée ?")) return;
    try { await request(`/notes/${id}`, { token, method: "DELETE" }); await load(); }
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

  const headings = { home: ["Bibliothèque documentaire", "Documents disponibles pour votre option et votre niveau."], class: ["Annonces", "Informations publiées pour votre parcours."], messages: ["Messagerie", "Messages des groupes auxquels votre compte appartient."], notes: ["Mes notes privées", "Ces notes ne sont accessibles qu’à votre compte."], profile: ["Mon profil", "Informations du compte et état des services."] };
  return <main className={dark ? "student-app student-dark" : "student-app student-light"}>
    <header className="student-topbar"><a className="brand" href="#accueil" onClick={e => {e.preventDefault();setActive("home");}}><span className="brand-mark">iF</span><span>iFac <span className="brand-light">universite</span></span></a><div className="student-top-actions"><span className="preview-pill">{user.firstName} {user.lastName}</span><button className="subtle-button" onClick={onLogout}>Déconnexion</button></div></header>
    <div className="student-body"><aside className="student-sidebar" aria-label="Navigation principale"><p className="student-nav-caption">ESPACE ÉTUDIANT</p>{destinations.map(x => <button key={x.id} className={active === x.id ? "student-nav-item selected" : "student-nav-item"} onClick={() => setActive(x.id)}><span className={"nav-symbol nav-symbol-" + x.id}>{x.short[0]}</span><span>{x.label}</span></button>)}<div className="student-sidebar-note">UPNCH au lancement</div></aside>
      <section className="student-main" aria-live="polite"><div className="student-welcome"><div><p className="student-eyebrow">ESPACE UNIVERSITAIRE</p><h1>{headings[active][0]}</h1><p>{headings[active][1]}</p></div><span className="student-campus-badge">UPNCH</span></div>
        {active === "profile" && <section className="student-card profile-preferences"><div><h2>Préférences d’affichage</h2><p>Choisissez l’apparence de l’interface.</p></div><button className="theme-button" onClick={() => setDark(v => !v)}>{dark ? "Thème clair" : "Thème sombre"}</button><p><strong>Compte :</strong> {user.email}</p><p><strong>Rôle :</strong> {user.role}</p>{adminStats && <p>Administration — utilisateurs : {adminStats.users} · documents : {adminStats.documents} · annonces : {adminStats.announcements}</p>}{user.role === "admin" && <form className="student-card note-form" onSubmit={uploadDocument}><h2>Ajouter un document PDF</h2><label className="field">Matière<select name="subjectId" required defaultValue=""><option value="">Choisir la matière</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name} — {s.option_name} / {s.level_label}</option>)}</select></label><label className="field">Titre<input name="title" maxLength="220" required /></label><label className="field">Fichier PDF<input name="file" type="file" accept="application/pdf,.pdf" required /></label><p>PDF uniquement, 15 Mo maximum. Les fichiers restent dans le stockage privé du serveur.</p><button className="theme-button" disabled={busy}>Téléverser le document</button></form>}</section>}
        {active === "notes" && <form className="student-card note-form" onSubmit={saveNote}><h2>Ajouter une note</h2><input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Titre de la note" maxLength="180" required /><textarea value={noteBody} onChange={e => setNoteBody(e.target.value)} placeholder="Écrire votre note privée…" maxLength="50000" rows="4" /><button className="theme-button" disabled={busy}>Enregistrer la note</button></form>}
        {active === "messages" && groups.length > 0 && <div className="student-card"><label>Groupe <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>{groups.map(g => <option key={g.id} value={g.id}>Groupe {g.id} · {g.group_type}</option>)}</select></label><div className="student-data-list">{messages.map(m => <article className="student-data-item" key={m.id}><strong>{m.first_name} {m.last_name}</strong><p>{m.body}</p><small>{new Date(m.created_at).toLocaleString()}</small></article>)}</div><form onSubmit={sendMessage}><textarea value={messageBody} onChange={e => setMessageBody(e.target.value)} placeholder="Votre message…" maxLength="5000" required /><button className="theme-button">Envoyer</button></form></div>}
        {busy && <p role="status">Chargement…</p>}{feedback && <p className="form-feedback" role="status">{feedback}</p>}
        {active !== "profile" && active !== "notes" && active !== "messages" && <section className="student-card student-data-list">{items.length === 0 && !busy ? <p>Aucun élément disponible pour le moment.</p> : items.map(item => <article className="student-data-item" key={item.id}><strong>{item.title}</strong>{item.subject && <p>Matière : {item.subject}</p>}<p>{item.body || (item.mime_type ? `${item.mime_type} · ${Math.round(Number(item.file_size_bytes || 0)/1024)} Ko` : "")}</p><small>{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</small>{active === "home" && <button className="theme-button" onClick={() => downloadDocument(item.id, item.title)}>Télécharger</button>}</article>)}</section>}
        {active === "notes" && <section className="student-card student-data-list">{items.length === 0 && !busy ? <p>Aucune note enregistrée.</p> : items.map(item => <article className="student-data-item" key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>Modifiée : {new Date(item.updated_at).toLocaleString()}</small><button className="theme-button" onClick={() => deleteNote(item.id)}>Supprimer</button></article>)}</section>}
        {active === "messages" && groups.length === 0 && !busy && <section className="student-card"><p>Aucun groupe de messagerie ne vous est encore attribué.</p></section>}
      </section></div>
    <nav className="student-mobile-nav" aria-label="Navigation mobile">{destinations.map(x => <button key={x.id} className={active === x.id ? "mobile-nav-item selected" : "mobile-nav-item"} onClick={() => setActive(x.id)}><span className={"mobile-nav-symbol nav-symbol-" + x.id}>{x.short[0]}</span><span>{x.short}</span></button>)}</nav>
  </main>;
}
