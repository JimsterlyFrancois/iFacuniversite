import { useEffect, useState } from "react";
import StudentShell from "./StudentShell.jsx";

const API = "/api/v1";
async function request(path, { token, ...options } = {}) {
  const headers = { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.error || "Une erreur est survenue.");
  return data;
}
function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("ifac_token") || "");
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("login");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [universities, setUniversities] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [options, setOptions] = useState([]);
  const [levels, setLevels] = useState([]);
  const [universityId, setUniversityId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [optionId, setOptionId] = useState("");
  const [studyLevelId, setStudyLevelId] = useState("");

  useEffect(() => { request("/catalog/universities").then(r => setUniversities(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { setFaculties([]); setOptions([]); setLevels([]); setFacultyId(""); setOptionId(""); setStudyLevelId(""); if (universityId) request(`/catalog/faculties?universityId=${universityId}`).then(r => setFaculties(r.data || [])).catch(e => setFeedback(e.message)); }, [universityId]);
  useEffect(() => { setOptions([]); setLevels([]); setOptionId(""); setStudyLevelId(""); if (facultyId) request(`/catalog/options?facultyId=${facultyId}`).then(r => setOptions(r.data || [])).catch(e => setFeedback(e.message)); }, [facultyId]);
  useEffect(() => { setLevels([]); setStudyLevelId(""); if (optionId) request(`/catalog/levels?optionId=${optionId}`).then(r => setLevels(r.data || [])).catch(e => setFeedback(e.message)); }, [optionId]);
  useEffect(() => { if (token) request("/auth/me", { token }).then(r => setUser(r.user)).catch(() => { sessionStorage.removeItem("ifac_token"); setToken(""); setUser(null); }); }, [token]);

  async function submit(event) {
    event.preventDefault(); setBusy(true); setFeedback("");
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "signup") {
        if (form.get("password") !== form.get("confirmPassword")) throw new Error("Les deux mots de passe ne correspondent pas.");
        await request("/auth/register", { method: "POST", body: JSON.stringify({
          firstName: form.get("firstName"), lastName: form.get("lastName"), email: form.get("email"),
          password: form.get("password"), universityId: Number(universityId), facultyId: Number(facultyId),
          optionId: Number(optionId), studyLevelId: Number(studyLevelId)
        }) });
        setMode("login"); setFeedback("Inscription envoyée. Consultez votre e-mail pour confirmer votre adresse avant de vous connecter.");
      } else {
        const result = await request("/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
        sessionStorage.setItem("ifac_token", result.token); setToken(result.token); setUser(result.user);
      }
    } catch (error) { setFeedback(error.message); } finally { setBusy(false); }
  }

  async function resetPassword() {
    const email = window.prompt("Entrez l’adresse e-mail de votre compte :");
    if (!email) return;
    setFeedback("");
    try { const r = await request("/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) }); setFeedback(r.message); }
    catch (e) { setFeedback(e.message); }
  }

  async function logout() {
    try { await request("/auth/logout", { method: "POST", token }); } catch {}
    sessionStorage.removeItem("ifac_token"); setToken(""); setUser(null); setMode("login"); setFeedback("Vous êtes déconnecté.");
  }

  const verifyToken = new URLSearchParams(window.location.search).get("token");
  useEffect(() => {
    if (window.location.pathname === "/verify-email" && verifyToken) {
      request("/auth/verify-email", { method: "POST", body: JSON.stringify({ token: verifyToken }) })
        .then(r => { setMode("login"); setFeedback(r.message); window.history.replaceState({}, "", "/"); })
        .catch(e => setFeedback(e.message));
    }
  }, [verifyToken]);

  if (token && user) return <StudentShell token={token} user={user} onLogout={logout} request={request} />;

  return <main className="page-shell">
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark">iF</span><span>iFac <span className="brand-light">universite</span></span></a><button type="button" className="top-login-button" onClick={() => { setMode("login"); setFeedback(""); document.getElementById("auth-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Connexion <span aria-hidden="true">→</span></button></header>
    <section className="auth-layout" aria-label="Connexion et inscription">
      <aside className="visual-panel"><img className="campus-image" src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1600&q=85" alt="Groupe d’étudiants universitaires réunis sur un campus" /><div className="visual-overlay" /><div className="visual-content"><p className="eyebrow">L’ESPACE DES ÉTUDIANTS HAÏTIENS</p><h1 className="hero-message">Votre parcours universitaire,<br /><span>mieux organisé.</span></h1><p>Retrouvez vos documents de cours, vos notes personnelles et les informations utiles à vos études dans un seul espace.</p><div className="hero-student-tags"><span>Documents de cours</span><span>Notes privées</span><span>Vie universitaire</span></div><button type="button" className="hero-login-button" onClick={() => { setMode("login"); setFeedback(""); document.getElementById("auth-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Se connecter <span aria-hidden="true">→</span></button></div></aside>
      <section className="form-panel" id="auth-card"><div className="form-inner"><div className="form-heading"><p className="eyebrow">iFAC UNIVERSITE</p><h2>{mode === "signup" ? "Créer votre compte" : "Se connecter"}</h2><p>{mode === "signup" ? "Choisissez votre parcours universitaire." : "Accédez à votre espace étudiant."}</p></div>
        <div className="auth-tabs"><button type="button" className={mode === "signup" ? "auth-tab active" : "auth-tab"} onClick={() => {setMode("signup");setFeedback("");}}>Inscription</button><button type="button" className={mode === "login" ? "auth-tab active" : "auth-tab"} onClick={() => {setMode("login");setFeedback("");}}>Connexion</button></div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && <><div className="field-row"><Field label="Nom"><input name="lastName" required maxLength="100" autoComplete="family-name" /></Field><Field label="Prénom"><input name="firstName" required maxLength="100" autoComplete="given-name" /></Field></div>
          <Field label="Université"><select required value={universityId} onChange={e => setUniversityId(e.target.value)}><option value="">Choisir l’université</option>{universities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Faculté / école"><select required value={facultyId} onChange={e => setFacultyId(e.target.value)} disabled={!universityId}><option value="">Choisir la faculté</option>{faculties.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Option"><select required value={optionId} onChange={e => setOptionId(e.target.value)} disabled={!facultyId}><option value="">Choisir l’option</option>{options.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Niveau"><select required value={studyLevelId} onChange={e => setStudyLevelId(e.target.value)} disabled={!optionId}><option value="">Choisir le niveau</option>{levels.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></Field></>}
          <Field label="Adresse e-mail"><input name="email" type="email" required autoComplete="email" placeholder="vous@exemple.com" /></Field>
          <Field label="Mot de passe"><input name="password" type="password" required minLength="10" maxLength="128" autoComplete={mode === "signup" ? "new-password" : "current-password"} /></Field>
          {mode === "signup" && <Field label="Confirmer le mot de passe"><input name="confirmPassword" type="password" required minLength="10" maxLength="128" autoComplete="new-password" /></Field>}
          {mode === "login" && <div className="forgot-row"><button type="button" onClick={resetPassword}>Mot de passe oublié ?</button></div>}
          <button className="submit-button" type="submit" disabled={busy}>{busy ? "Veuillez patienter…" : mode === "signup" ? "Créer mon compte →" : "Se connecter →"}</button>
          {feedback && <p className="form-feedback" role="status">{feedback}</p>}
          <p className="form-footer">Protégez votre compte en utilisant un mot de passe unique.</p>
        </form>
      </div></section>
    </section>
    <footer className="site-footer"><span>iFac universite</span><span>Votre espace pour mieux réussir à l’université.</span></footer>
  </main>;
}
