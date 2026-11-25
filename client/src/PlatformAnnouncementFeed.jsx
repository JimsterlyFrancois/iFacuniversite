import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "./apiBase.js";

const API = apiUrl("/api/v1");

export default function PlatformAnnouncementFeed({ token }) {
  const [items, setItems] = useState([]);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setItems([]); return; }
    try {
      const response = await fetch(`${API}/general-announcements`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (!response.ok) return;
      const result = await response.json();
      setItems(Array.isArray(result.data) ? result.data : []);
    } catch {
      // The workspace remains available if the announcement feed is offline.
    }
  }, [token]);

  useEffect(() => {
    load();
    const onFocus = () => load();
    const onVisibility = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  if (!items.length) return null;
  const visibleItems = expanded ? items : items.slice(0, 2);
  return <section className="ifac-platform-notices" aria-label="Annonces officielles iFac">
    <style>{`.ifac-platform-notices{margin:14px auto 0;max-width:1380px;padding:0 18px;color:#171717}.ifac-platform-notices-inner{border:1px solid #ead59d;border-left:4px solid #d99b00;border-radius:10px;background:#fffaf0;padding:13px 15px}.ifac-platform-notices-heading{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:9px}.ifac-platform-notices-heading strong{font-size:13px}.ifac-platform-notices-heading button{border:0;background:transparent;color:#805400;font:inherit;font-size:11px;font-weight:700;cursor:pointer;padding:6px}.ifac-platform-notice{padding:8px 0;border-top:1px solid #f0e4c4}.ifac-platform-notice:first-child{border-top:0}.ifac-platform-notice h3{font-size:12px;margin:0 0 4px}.ifac-platform-notice p{font-size:12px;line-height:1.55;margin:0;white-space:pre-wrap;color:#4f4634}.ifac-platform-notice time{font-size:10px;color:#8a7955;display:block;margin-top:5px}@media(max-width:600px){.ifac-platform-notices{padding:0 9px}.ifac-platform-notices-inner{padding:11px}}`}</style>
    <div className="ifac-platform-notices-inner">
      <div className="ifac-platform-notices-heading"><strong>Annonces officielles de la plateforme</strong>{items.length>2&&<button type="button" onClick={()=>setExpanded(value=>!value)}>{expanded?"Réduire":"Voir toutes ("+items.length+")"}</button>}</div>
      {visibleItems.map(item=><article className="ifac-platform-notice" key={item.id}><h3>{item.title}</h3><p>{item.body}</p><time>{new Date(item.created_at).toLocaleDateString("fr-FR")}</time></article>)}
    </div>
  </section>;
}
