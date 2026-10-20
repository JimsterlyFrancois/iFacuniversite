import { useEffect, useState } from "react";

const sections = [
  { title: "Cours", description: "Retrouver les matières de votre niveau.", icon: "01" },
  { title: "Documents", description: "Consulter les supports pédagogiques disponibles.", icon: "02" },
  { title: "Mes notes", description: "Préparer un espace pour suivre vos notes.", icon: "03" },
  { title: "Profil", description: "Les informations du compte seront affichées ici.", icon: "04" }
];

export default function App() {
  const [apiStatus, setApiStatus] = useState("Vérification du serveur…");

  useEffect(() => {
    fetch("/api/health")
      .then((response) => {
        if (!response.ok) throw new Error("API indisponible");
        return response.json();
      })
      .then((data) => setApiStatus(data.status === "ok" ? "Serveur connecté" : "Réponse inattendue"))
      .catch(() => setApiStatus("Serveur non connecté"));
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Accueil iFacuniversite">
          <span className="brand-mark">iF</span>
          <span>iFac<span className="brand-light">universite</span></span>
        </a>
        <span className="status"><span className="status-dot" />{apiStatus}</span>
      </header>

      <section className="hero">
        <p className="eyebrow">ESPACE UNIVERSITAIRE</p>
        <h1>Votre parcours universitaire,<br /><span>mieux organisé.</span></h1>
        <p className="hero-copy">
          Un espace de travail pour retrouver les cours, les documents et les outils utiles à la vie étudiante.
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href="#services">Découvrir l’espace <span aria-hidden="true">↘</span></a>
          <span className="prototype-note">Version de démarrage</span>
        </div>
      </section>

      <section className="section" id="services">
        <div className="section-heading">
          <div>
            <p className="eyebrow">VOTRE ESPACE</p>
            <h2>Tout au même endroit.</h2>
          </div>
          <p className="section-note">Les fonctionnalités seront activées progressivement.</p>
        </div>
        <div className="service-grid">
          {sections.map((item) => (
            <article className="service-card" key={item.title}>
              <span className="service-number">{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <span className="card-arrow" aria-hidden="true">↗</span>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <span>iFacuniversite</span>
        <span>Projet en cours de développement</span>
      </footer>
    </main>
  );
}