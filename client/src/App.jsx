import { useEffect, useState } from "react";
import StudentShell from "./StudentShell.jsx";
import ProfessorShell from "./ProfessorShell.jsx";
import ProgramManagerShell from "./ProgramManagerShell.jsx";
import FacultyManagerShell from "./FacultyManagerShell.jsx";
import UniversityAdminShell from "./UniversityAdminShell.jsx";
import GeneralAdminShell from "./GeneralAdminShell.jsx";

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
  const [adminView, setAdminView] = useState("general");
  const [workspaceRole, setWorkspaceRole] = useState("");
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("login");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [identityScreen, setIdentityScreen] = useState(false);
  const [identityFeedback, setIdentityFeedback] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [universityId, setUniversityId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [optionId, setOptionId] = useState("");
  const [studyLevelId, setStudyLevelId] = useState("");

  // Le catalogue est chargé depuis l'API et la base de données.
  const [universities, setUniversities] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [options, setOptions] = useState([]);
  const [levels, setLevels] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState({ universities: false, faculties: false, options: false, levels: false });
  const [catalogErrors, setCatalogErrors] = useState({ universities: "", faculties: "", options: "", levels: "" });

  const selectedUniversity = universities.find(x => String(x.id) === String(universityId));
  const selectedFaculty = faculties.find(x => String(x.id) === String(facultyId));
  const selectedOption = options.find(x => String(x.id) === String(optionId));

  async function loadCatalogList(kind, path, setter) {
    setCatalogLoading(previous => ({ ...previous, [kind]: true }));
    setCatalogErrors(previous => ({ ...previous, [kind]: "" }));
    try {
      const result = await request(path);
      setter(result.data || []);
    } catch {
      setter([]);
      setCatalogErrors(previous => ({ ...previous, [kind]: "Impossible de charger cette liste. Vérifiez la connexion." }));
    } finally {
      setCatalogLoading(previous => ({ ...previous, [kind]: false }));
    }
  }

  useEffect(() => {
    loadCatalogList("universities", "/catalog/universities", setUniversities);
  }, []);

  useEffect(() => {
    setFacultyId("");
    setOptionId("");
    setStudyLevelId("");
    setFaculties([]);
    setOptions([]);
    setLevels([]);
    if (!universityId) return;
    loadCatalogList("faculties", `/catalog/faculties?universityId=${encodeURIComponent(universityId)}`, setFaculties);
  }, [universityId]);

  useEffect(() => {
    setOptionId("");
    setStudyLevelId("");
    setOptions([]);
    setLevels([]);
    if (!facultyId) return;
    loadCatalogList("options", `/catalog/options?facultyId=${encodeURIComponent(facultyId)}`, setOptions);
  }, [facultyId]);

  useEffect(() => {
    setStudyLevelId("");
    setLevels([]);
    if (!optionId) return;
    loadCatalogList("levels", `/catalog/levels?optionId=${encodeURIComponent(optionId)}`, setLevels);
  }, [optionId]);

  useEffect(() => { if (token) request("/auth/me", { token }).then(r => setUser(r.user)).catch(() => { sessionStorage.removeItem("ifac_token"); setToken(""); setUser(null); }); }, [token]);

  useEffect(() => {
    if (!user) { setWorkspaceRole(""); return; }
    const rawRoles = [...new Set([...(user.workspaces || []).map(item => item.role), user.baseRole].filter(Boolean))];
    const roles = rawRoles.filter(role => !(role === "admin" && rawRoles.includes("admin_general")));
    const preferred = user.role === "admin" && roles.includes("admin_general") ? "admin_general" : user.role;
    setWorkspaceRole(roles.includes(preferred) ? preferred : (roles[0] || preferred));
  }, [user]);

  useEffect(() => {
    if (!identityScreen) return undefined;
    const timer = window.setTimeout(() => {
      setIdentityScreen(false);
      if (identityFeedback) setFeedback(identityFeedback);
      setIdentityFeedback("");
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [identityScreen, identityFeedback]);

  async function submit(event) {
    event.preventDefault(); setBusy(true); setFeedback("");
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "professor") {
        if (form.get("password") !== form.get("confirmPassword")) throw new Error("Les deux codes secrets ne correspondent pas.");
        const result = await request("/auth/professor/register", { method: "POST", body: JSON.stringify({ firstName: form.get("firstName"), lastName: form.get("lastName"), email: form.get("email"), password: form.get("password") }) });
        setMode("login"); setFeedback(""); setIdentityFeedback(result.message || "Confirmez votre adresse e-mail. Votre nomination sera effectuée par un responsable de programme."); setIdentityScreen(true);
      } else if (mode === "signup") {
        if (form.get("password") !== form.get("confirmPassword")) throw new Error("Les deux mots de passe ne correspondent pas.");
        const result = await request("/auth/register", { method: "POST", body: JSON.stringify({
          firstName: form.get("firstName"), lastName: form.get("lastName"), email: form.get("email"),
          password: form.get("password"), universityCode: selectedUniversity?.code, facultyCode: selectedFaculty?.code,
          optionCode: selectedOption?.code, studyLevelCode: levels.find(x => String(x.id) === String(studyLevelId))?.code
        }) });
        setMode("login"); setFeedback(""); setIdentityFeedback(result.message || "Consultez votre e-mail pour confirmer votre compte."); setIdentityScreen(true);
      } else {
        const result = await request("/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
        sessionStorage.setItem("ifac_token", result.token); setToken(result.token); setUser(result.user); setIdentityFeedback(""); setIdentityScreen(true);
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
    sessionStorage.removeItem("ifac_token"); setToken(""); setUser(null); setMode("login"); setAdminView("general"); setFeedback("Vous êtes déconnecté.");
  }

  const verifyToken = new URLSearchParams(window.location.search).get("token");
  const authAccessToken = new URLSearchParams(window.location.hash.slice(1)).get("access_token");
  useEffect(() => {
    if (window.location.pathname !== "/verify-email") return;
    const token = authAccessToken || verifyToken;
    if (!token) {
      setFeedback("Le lien de confirmation est incomplet. Ouvrez le lien reçu dans votre e-mail ou recommencez l’inscription.");
      return;
    }
    request("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) })
      .then(r => { setMode("login"); setFeedback(r.message); window.history.replaceState({}, "", "/"); })
      .catch(e => setFeedback(e.message));
  }, [verifyToken, authAccessToken]);

  if (identityScreen) return <main className="identity-splash" role="status" aria-live="polite"><div className="identity-splash-content"><img src="/ifac-logo.svg" alt="Emblème iFac Université" className="identity-splash-logo" /><p className="identity-splash-kicker">L’IDENTITÉ UNIVERSITAIRE</p><h1>iFAC <span>UNIVERSITÉ</span></h1><p className="identity-splash-caption">Votre parcours universitaire, mieux organisé.</p><span className="identity-splash-progress" aria-hidden="true" /></div></main>;

  if (token && user) {
    const rawRoles = [...new Set([...(user.workspaces || []).map(item => item.role), user.baseRole].filter(Boolean))];
    const roles = rawRoles.filter(role => !(role === "admin" && rawRoles.includes("admin_general")));
    const activeRole = roles.includes(workspaceRole) ? workspaceRole : user.role;
    const workspaceUser = { ...user, role: activeRole };
    const studentAdminUser = { ...user, role: user.baseRole === "admin" ? "admin" : (user.baseRole || activeRole) };
    const labels = {
      admin: "Administrateur général", admin_general: "Administrateur général",
      university_admin: "Responsable d’université", faculty_manager: "Responsable de faculté",
      program_manager: "Responsable de programme", professor: "Professeur",
      student: "Étudiant", delegate: "Délégué"
    };
    let workspace;
    if (activeRole === "admin" || activeRole === "admin_general") {
      workspace = adminView === "general"
        ? <GeneralAdminShell token={token} user={workspaceUser} onLogout={logout} request={request} onOpenAcademicAdmin={() => setAdminView("academic")} />
        : <StudentShell token={token} user={studentAdminUser} onLogout={logout} request={request} onOpenGeneralAdmin={() => setAdminView("general")} />;
    } else if (activeRole === "university_admin") workspace = <UniversityAdminShell token={token} user={workspaceUser} onLogout={logout} request={request} />;
    else if (activeRole === "faculty_manager") workspace = <FacultyManagerShell token={token} user={workspaceUser} onLogout={logout} request={request} />;
    else if (activeRole === "program_manager") workspace = <ProgramManagerShell token={token} user={workspaceUser} onLogout={logout} request={request} />;
    else if (activeRole === "professor") workspace = <ProfessorShell token={token} user={workspaceUser} onLogout={logout} request={request} />;
    else workspace = <StudentShell token={token} user={workspaceUser} onLogout={logout} request={request} />;
    return <div className="ifac-workspace-root">
      {roles.length > 1 && <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:10,padding:"8px 16px",background:"#171717",color:"#fff",fontSize:12}}>
        <label htmlFor="ifac-workspace-select">Changer d’espace</label>
        <select id="ifac-workspace-select" value={activeRole} onChange={event => {setWorkspaceRole(event.target.value);setAdminView("general");}} style={{maxWidth:260,padding:"7px 10px",borderRadius:7,border:"1px solid #777",background:"#fff",color:"#171717"}}>
          {roles.map(role => <option key={role} value={role}>{labels[role] || role}</option>)}
        </select>
      </div>}
      {workspace}
    </div>;
  }

  return <main className="page-shell">
    <header className="topbar"><a className="brand" href="/"><img className="brand-logo" src="/ifac-logo.svg" alt="" /><span>iFac <span className="brand-light">universite</span></span></a><button type="button" className="top-login-button" onClick={() => { setMode("login"); setFeedback(""); document.getElementById("auth-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Connexion <span aria-hidden="true">→</span></button></header>
    <section className="auth-layout" aria-label="Connexion et inscription">
      <aside className="visual-panel"><img className="campus-image" src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1000&q=70" alt="Groupe d’étudiants universitaires réunis sur un campus" /><div className="visual-overlay" /><div className="visual-content"><p className="eyebrow">L’ESPACE DES ÉTUDIANTS HAÏTIENS</p><h1 className="hero-message">Votre parcours universitaire,<br /><span>mieux organisé.</span></h1><p>Retrouvez vos documents de cours, vos notes personnelles et les informations utiles à vos études dans un seul espace.</p><div className="hero-student-tags"><span>Documents de cours</span><span>Notes privées</span><span>Vie universitaire</span></div><button type="button" className="hero-login-button" onClick={() => { setMode("login"); setFeedback(""); document.getElementById("auth-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Se connecter <span aria-hidden="true">→</span></button></div></aside>
      <section className="form-panel" id="auth-card"><div className="form-inner"><div className="form-heading"><p className="eyebrow">iFAC UNIVERSITE</p><h2>{mode === "signup" ? "Créer votre compte" : mode === "professor" ? "Créer un compte professeur" : "Se connecter"}</h2><p>{mode === "signup" ? "Choisissez votre parcours universitaire." : mode === "professor" ? "Inscrivez-vous. Votre affectation pédagogique sera ajoutée après votre nomination." : "Accédez à votre espace universitaire."}</p></div>
        <div className="auth-tabs"><button type="button" className={mode === "signup" ? "auth-tab active" : "auth-tab"} onClick={() => {setMode("signup");setFeedback("");}}>Inscription étudiant</button><button type="button" className={mode === "professor" ? "auth-tab active" : "auth-tab"} onClick={() => {setMode("professor");setFeedback("");}}>Espace professeur</button><button type="button" className={mode === "login" ? "auth-tab active" : "auth-tab"} onClick={() => {setMode("login");setFeedback("");}}>Connexion</button></div>
        <form className="auth-form" onSubmit={submit}>
          {(mode === "signup" || mode === "professor") && <div className="field-row"><Field label="Nom"><input name="lastName" required maxLength="100" autoComplete="family-name" /></Field><Field label="Prénom"><input name="firstName" required maxLength="100" autoComplete="given-name" /></Field></div>}
          {mode === "signup" && <>
          <Field label="Université"><select required value={universityId} onChange={e => setUniversityId(e.target.value)}><option value="">{catalogLoading.universities ? "Chargement des universités…" : "Choisir l’université"}</option>{universities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>{catalogErrors.universities && <small className="form-feedback" role="status">{catalogErrors.universities}</small>}</Field>
          <Field label="Faculté / école"><select required value={facultyId} onChange={e => setFacultyId(e.target.value)} disabled={!universityId}><option value="">{catalogLoading.faculties ? "Chargement des facultés…" : "Choisir la faculté"}</option>{faculties.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>{catalogErrors.faculties && <small className="form-feedback" role="status">{catalogErrors.faculties}</small>}</Field>
          <Field label="Option"><select required value={optionId} onChange={e => setOptionId(e.target.value)} disabled={!facultyId}><option value="">{catalogLoading.options ? "Chargement des options…" : "Choisir l’option"}</option>{options.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>{catalogErrors.options && <small className="form-feedback" role="status">{catalogErrors.options}</small>}</Field>
          <Field label="Niveau"><select required value={studyLevelId} onChange={e => setStudyLevelId(e.target.value)} disabled={!optionId}><option value="">{catalogLoading.levels ? "Chargement des niveaux…" : "Choisir le niveau"}</option>{levels.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select>{catalogErrors.levels && <small className="form-feedback" role="status">{catalogErrors.levels}</small>}</Field></>}
          <Field label="Adresse e-mail"><input name="email" type="email" required autoComplete="email" placeholder="vous@exemple.com" /></Field>
          <Field label="Mot de passe"><div className="password-wrap"><input name="password" type={showPassword ? "text" : "password"} required minLength="10" maxLength="128" autoComplete={mode === "login" ? "current-password" : "new-password"} /><button className="password-toggle" type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{showPassword ? "Masquer" : "Voir"}</button></div></Field>
          {(mode === "signup" || mode === "professor") && <Field label={mode === "professor" ? "Confirmer le code secret" : "Confirmer le mot de passe"}><div className="password-wrap"><input name="confirmPassword" type={showConfirmPassword ? "text" : "password"} required minLength="10" maxLength="128" autoComplete="new-password" /><button className="password-toggle" type="button" onClick={() => setShowConfirmPassword(v => !v)} aria-label={showConfirmPassword ? "Masquer la confirmation" : "Afficher la confirmation"}>{showConfirmPassword ? "Masquer" : "Voir"}</button></div></Field>}
          {mode === "login" && <div className="forgot-row"><button type="button" onClick={resetPassword}>Mot de passe oublié ?</button></div>}
          <button className="submit-button" type="submit" disabled={busy}>{busy ? "Veuillez patienter…" : mode === "signup" ? "Créer mon compte →" : mode === "professor" ? "Créer mon compte professeur →" : "Se connecter →"}</button>
          {feedback && <p className="form-feedback" role="status">{feedback}</p>}
          <p className="form-footer">Protégez votre compte en utilisant un mot de passe unique.</p>
        </form>
      </div></section>
    </section>
    <footer className="site-footer"><span>iFac universite</span><span>Votre espace pour mieux réussir à l’université.</span></footer>
  </main>;
}
