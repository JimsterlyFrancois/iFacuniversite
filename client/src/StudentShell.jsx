import { useState } from "react";

const destinations = [
  { id: "class", label: "Classe", short: "Classe" },
  { id: "messages", label: "Messages", short: "Messages" },
  { id: "home", label: "Accueil", short: "Accueil" },
  { id: "notes", label: "Notes", short: "Notes" },
  { id: "profile", label: "Profil", short: "Profil" }
];

const content = {
  class: { title: "Ma classe", intro: "Les annonces destinées à votre parcours apparaîtront ici.", empty: "Aucune annonce pour l’instant." },
  messages: { title: "Messages", intro: "Les groupes seront disponibles après la configuration des comptes et des autorisations.", empty: "Aucune conversation disponible." },
  home: { title: "Bibliothèque", intro: "Les documents seront classés par matière selon votre profil universitaire.", empty: "Aucun document pour l’instant." },
  notes: { title: "Mes notes", intro: "Vos notes personnelles seront privées et associées à votre compte après activation du service.", empty: "Aucune note pour l’instant." },
  profile: { title: "Mon profil", intro: "Les informations du compte et les préférences apparaîtront ici.", empty: "Le profil étudiant sera disponible après la mise en place de l’authentification." }
};

export default function StudentShell({ onBack }) {
  const [active, setActive] = useState("home");
  const [dark, setDark] = useState(true);
  const page = content[active];

  return (
    <main className={dark ? "student-app student-dark" : "student-app student-light"}>
      <header className="student-topbar">
        <a className="brand" href="#accueil" onClick={(event) => { event.preventDefault(); setActive("home"); }} aria-label="Accueil iFac universite">
          <span className="brand-mark">iF</span>
          <span>iFac <span className="brand-light">universite</span></span>
        </a>
        <div className="student-top-actions">
          <span className="preview-pill">Aperçu de l’interface</span>
          <button className="subtle-button" type="button" onClick={onBack}>Retour connexion</button>
        </div>
      </header>

      <div className="student-body">
        <aside className="student-sidebar" aria-label="Navigation principale">
          <p className="student-nav-caption">ESPACE ÉTUDIANT</p>
          {destinations.map((item) => (
            <button key={item.id} type="button" className={active === item.id ? "student-nav-item selected" : "student-nav-item"} onClick={() => setActive(item.id)} aria-current={active === item.id ? "page" : undefined}>
              <span className={"nav-symbol nav-symbol-" + item.id} aria-hidden="true">{({ class: "C", messages: "M", home: "A", notes: "N", profile: "P" })[item.id]}</span>
              <span>{item.label}</span>
            </button>
          ))}
          <div className="student-sidebar-note">UPNCH au lancement</div>
        </aside>

        <section className="student-main" aria-live="polite">
          <div className="student-welcome">
            <div>
              <p className="student-eyebrow">ESPACE UNIVERSITAIRE</p>
              <h1>{page.title}</h1>
              <p>{page.intro}</p>
            </div>
            <span className="student-campus-badge">UPNCH</span>
          </div>

          {active === "home" && (
            <div className="student-filter-row">
              <label>Faculté / école <select disabled defaultValue=""><option value="">À configurer</option></select></label>
              <label>Option <select disabled defaultValue=""><option value="">À configurer</option></select></label>
              <label>Niveau <select disabled defaultValue=""><option value="">À configurer</option></select></label>
            </div>
          )}

          {active === "profile" && (
            <section className="student-card profile-preferences">
              <div><h2>Préférences d’affichage</h2><p>Choisissez l’apparence de l’interface.</p></div>
              <button type="button" className="theme-button" onClick={() => setDark((value) => !value)}>{dark ? "Passer au thème clair" : "Passer au thème sombre"}</button>
            </section>
          )}

          <section className="student-empty-card">
            <div className="empty-illustration" aria-hidden="true"><span /></div>
            <h2>{page.empty}</h2>
            <p>Cette page est préparée. Son contenu sera affiché lorsqu’il sera relié à une source de données vérifiée.</p>
          </section>
          <p className="student-prototype-note">Mode aperçu uniquement : aucune connexion, donnée personnelle, note, annonce ou document réel n’est chargé ou enregistré.</p>
        </section>
      </div>

      <nav className="student-mobile-nav" aria-label="Navigation mobile">
        {destinations.map((item) => (
          <button key={item.id} type="button" className={active === item.id ? "mobile-nav-item selected" : "mobile-nav-item"} onClick={() => setActive(item.id)} aria-current={active === item.id ? "page" : undefined}>
            <span className={"mobile-nav-symbol nav-symbol-" + item.id} aria-hidden="true">{({ class: "C", messages: "M", home: "A", notes: "N", profile: "P" })[item.id]}</span>
            <span>{item.short}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}
