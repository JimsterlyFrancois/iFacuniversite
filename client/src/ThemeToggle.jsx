export default function ThemeToggle({ theme = "light", onToggleTheme }) {
  const dark = theme === "dark";
  const label = dark ? "Passer au mode clair" : "Passer au mode sombre";
  return (
    <button type="button" className="ifac-theme-toggle" onClick={onToggleTheme}
      aria-label={label} aria-pressed={dark} title={label}>
      <span className="ifac-theme-toggle-icon" aria-hidden="true">{dark ? "☀" : "☾"}</span>
      <span>{dark ? "Mode clair" : "Mode sombre"}</span>
    </button>
  );
}
