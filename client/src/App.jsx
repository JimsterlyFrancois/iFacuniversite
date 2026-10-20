import { useMemo, useState } from "react";
import StudentShell from "./StudentShell.jsx";

const schools = [
  {
    name: "Faculté des Sciences de l’Éducation (FSE)",
    options: ["Psychopédagogie", "Administration scolaire", "Mathématiques et Physique", "Histoire et Géographie"]
  },
  {
    name: "ESSAP / Médecine Tropicale / Travail Social (ESSAP/MT/TS)",
    options: ["Santé Publique", "Médecine Tropicale", "Travail Social"]
  },
  {
    name: "École Supérieure Universitaire de Tourisme et d’Hôtellerie (ESUTH)",
    options: ["Gestion Touristique", "Hôtellerie et Restauration"]
  },
  {
    name: "Faculté de Droit, de Sciences Politiques et de Relations Internationales (FDSPRI)",
    options: ["Sciences Juridiques / Droit", "Science Politique", "Relations Internationales"]
  }
];

const levels = [
  "1re année (L1)",
  "2e année (L2)",
  "3e année (L3)",
  "4e année (L4)"
];

function PasswordField({ id, label, value, onChange, visible, onToggle, autoComplete, minLength }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label} <span aria-hidden="true">*</span></label>
      <div className="password-wrap">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          minLength={minLength}
          required
        />
        <button
          className="password-toggle"
          type="button"
          onClick={onToggle}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          {visible ? "Masquer" : "Afficher"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("auth");
  const [mode, setMode] = useState("signup");
  const [schoolName, setSchoolName] = useState("");
  const [option, setOption] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const selectedSchool = useMemo(
    () => schools.find((school) => school.name === schoolName),
    [schoolName]
  );

  function changeMode(nextMode) {
    setMode(nextMode);
    setFeedback("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPassword("");
    setConfirmPassword("");
  }

  function handlePasswordReset() {
    setFeedback("La récupération du mot de passe sera activée lorsque le service e-mail sécurisé sera configuré.");
  }

  function handleSubmit(event) {
    event.preventDefault();
    setFeedback("");

    if (mode === "signup" && password !== confirmPassword) {
      setFeedback("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setFeedback(
      mode === "signup"
        ? "Formulaire vérifié. L’inscription réelle et l’e-mail de confirmation doivent encore être reliés au serveur avant le lancement."
        : "La connexion sécurisée doit encore être reliée au serveur. Aucun compte n’a été connecté."
    );
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Accueil iFac universite">
          <span className="brand-mark">iF</span>
          <span>iFac <span className="brand-light">universite</span></span>
        </a>
        <div className="topbar-actions"><span className="campus-label"><span className="status-dot" /> Première version · UPNCH</span><button className="preview-open-button" type="button" onClick={() => setView("preview")}>Aperçu de l’application</button></div>
      </header>

      <section className="auth-layout" aria-label="Inscription et connexion à iFac universite">
        <aside className="visual-panel">
          <img
            className="campus-image"
            src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80"
            alt="Étudiants réunis sur un campus universitaire"
            fetchPriority="high"
          />
          <div className="visual-overlay" />
          <div className="visual-content">
            <p className="eyebrow">VOTRE AVENIR, VOTRE ESPACE</p>
            <h1>Apprendre.<br /><span>Progresser.</span><br />Réussir.</h1>
            <p>Les ressources universitaires de l’UPNCH, réunies dans un espace conçu pour les étudiants.</p>
            <div className="visual-footnote"><span className="gold-line" /> Un projet conçu pour évoluer avec les universités publiques haïtiennes.</div>
          </div>
          <div className="decor-orbit orbit-one" />
          <div className="decor-orbit orbit-two" />
        </aside>

        <section className="form-panel">
          <div className="form-inner">
            <div className="form-heading">
              <p className="eyebrow">{mode === "signup" ? "REJOINDRE IFAC" : "BON RETOUR"}</p>
              <h2>{mode === "signup" ? "Créer votre compte" : "Se connecter"}</h2>
              <p>{mode === "signup" ? "Renseignez vos informations pour préparer votre espace étudiant." : "Connectez-vous avec l’adresse e-mail associée à votre compte."}</p>
            </div>

            <div className="auth-tabs" role="tablist" aria-label="Choisir une action">
              <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "auth-tab active" : "auth-tab"} onClick={() => changeMode("signup")}>Inscription</button>
              <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "auth-tab active" : "auth-tab"} onClick={() => changeMode("login")}>Connexion</button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {mode === "signup" ? (
                <>
                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="lastName">Nom <span aria-hidden="true">*</span></label>
                      <input id="lastName" name="lastName" type="text" autoComplete="family-name" required />
                    </div>
                    <div className="field">
                      <label htmlFor="firstName">Prénom <span aria-hidden="true">*</span></label>
                      <input id="firstName" name="firstName" type="text" autoComplete="given-name" required />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="signupEmail">Adresse e-mail <span aria-hidden="true">*</span></label>
                    <input id="signupEmail" name="email" type="email" autoComplete="email" placeholder="vous@exemple.com" required />
                  </div>

                  <div className="field">
                    <label htmlFor="school">Faculté / école <span aria-hidden="true">*</span></label>
                    <select
                      id="school"
                      name="school"
                      value={schoolName}
                      onChange={(event) => {
                        setSchoolName(event.target.value);
                        setOption("");
                      }}
                      required
                    >
                      <option value="">Choisir une faculté ou une école</option>
                      {schools.map((school) => <option key={school.name} value={school.name}>{school.name}</option>)}
                    </select>
                  </div>

                  {selectedSchool?.options.length > 0 && (
                    <div className="field">
                      <label htmlFor="option">Option <span aria-hidden="true">*</span></label>
                      <select id="option" name="option" value={option} onChange={(event) => setOption(event.target.value)} required>
                        <option value="">Choisir votre option</option>
                        {selectedSchool.options.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="field">
                    <label htmlFor="level">Niveau d’études <span aria-hidden="true">*</span></label>
                    <select id="level" name="level" required defaultValue="">
                      <option value="" disabled>Choisir votre niveau</option>
                      {levels.map((level) => <option key={level} value={level}>{level}</option>)}
                    </select>
                  </div>

                  <PasswordField
                    id="signupPassword"
                    label="Mot de passe"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    visible={showPassword}
                    onToggle={() => setShowPassword((current) => !current)}
                    autoComplete="new-password"
                    minLength={8}
                  />
                  <p className="field-hint">8 caractères minimum.</p>
                  <PasswordField
                    id="confirmPassword"
                    label="Confirmer le mot de passe"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    visible={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((current) => !current)}
                    autoComplete="new-password"
                    minLength={8}
                  />
                  <button className="submit-button" type="submit">Créer mon compte <span aria-hidden="true">→</span></button>
                  <p className="verification-note"><span className="lock-mark" aria-hidden="true">✓</span> Une confirmation par e-mail sera nécessaire avant l’activation complète du compte.</p>
                </>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="loginEmail">Adresse e-mail <span aria-hidden="true">*</span></label>
                    <input id="loginEmail" name="email" type="email" autoComplete="email" placeholder="vous@exemple.com" required />
                  </div>
                  <PasswordField
                    id="loginPassword"
                    label="Mot de passe"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    visible={showPassword}
                    onToggle={() => setShowPassword((current) => !current)}
                    autoComplete="current-password"
                  />
                  <div className="forgot-row"><button type="button" onClick={handlePasswordReset}>Mot de passe oublié ?</button></div>
                  <button className="submit-button" type="submit">Se connecter <span aria-hidden="true">→</span></button>
                  <p className="verification-note"><span className="lock-mark" aria-hidden="true">✓</span> L’adresse e-mail doit être confirmée pour activer le compte.</p>
                </>
              )}

              {feedback && <p className="form-feedback" role="status">{feedback}</p>}
            </form>
            <p className="form-footer">En continuant, vous utilisez une interface en préparation. N’entrez pas encore de mot de passe que vous utilisez sur un autre service.</p>
          </div>
        </section>
      </section>

      <footer className="site-footer">
        <span>iFac universite</span>
        <span>Prototype d’interface · UPNCH au lancement</span>
      </footer>
    </main>
  );
}
