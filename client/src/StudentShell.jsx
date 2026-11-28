import { useEffect, useRef, useState } from "react";
import { apiUrl } from "./apiBase.js";
import ProfessorManagement from "./ProfessorManagement.jsx";
import CourseManagement from "./CourseManagement.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import { isNativeApp, cacheNativeDocument, getCachedNativeDocument, listCachedNativeDocuments } from "./nativeStorage.js";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const destinations = [
  { id: "class", label: "Annonces", short: "Infos" },
  { id: "classDocs", label: "Documents de classe", short: "Cours" },
  { id: "notifications", label: "Notifications", short: "Alertes" },
  { id: "classAdmin", label: "Gestion des classes", short: "Gestion", adminOnly: true },
  { id: "professors", label: "Gestion des professeurs", short: "Profs", adminOnly: true },
  { id: "courses", label: "Gestion des cours", short: "Cours", adminOnly: true },
  { id: "adminMessages", label: "Messages des délégués", short: "Délégués", adminOnly: true },
  { id: "groupAdmin", label: "Groupes de messagerie", short: "Groupes", adminOnly: true },
  { id: "messages", label: "Messagerie", short: "Messages" },
  { id: "home", label: "Documents", short: "Documents" },
  { id: "notes", label: "Notes privées", short: "Notes" },
  { id: "profile", label: "Profil", short: "Profil" }
];




const pdfCoverCache = new Map();
function PdfCoverPreview({ id, title, token, endpoint, compact = false }) {
  const hostRef = useRef(null);
  const [cover, setCover] = useState(() => pdfCoverCache.get(String(endpoint)) || "");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let started = false;
    let observer;
    const renderCover = async () => {
      if (started) return;
      started = true;
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        // PDF.js requests only the byte ranges needed for page one. The API
        // supports HTTP 206 responses so previews do not download full PDFs.
        const pdf = await pdfjs.getDocument({
          url: apiUrl(endpoint),
          httpHeaders: { Authorization: `Bearer ${token}` },
          disableStream: true,
          disableAutoFetch: true,
          rangeChunkSize: 64 * 1024
        }).promise;
        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const targetWidth = compact ? 82 : 190;
        const viewport = page.getViewport({ scale: targetWidth / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
        const image = canvas.toDataURL("image/jpeg", 0.76);
        pdfCoverCache.set(String(endpoint), image);
        if (!cancelled) setCover(image);
        page.cleanup();
        await pdf.destroy();
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    const node = hostRef.current;
    if (node && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect();
          void renderCover();
        }
      }, { rootMargin: "180px" });
      observer.observe(node);
    } else {
      void renderCover();
    }
    return () => { cancelled = true; observer?.disconnect(); };
  }, [endpoint, token, compact]);
  return <div ref={hostRef} className={compact ? "pdf-cover-preview compact" : "pdf-cover-preview"} aria-label={`Aperçu de la première page : ${title}`}>
    {cover ? <img src={cover} alt={`Première page de ${title}`} loading="lazy" /> : <div className="pdf-cover-placeholder"><span>PDF</span><small>{failed ? "Aperçu indisponible" : "Aperçu de couverture"}</small></div>}
  </div>;
}

function NavigationIcon({ name, theme = "light" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" };
  const christmas = theme === "christmas";
  return <svg viewBox="0 0 32 32" aria-hidden="true" {...common}>
    {name === "messages" ? <><path d="M5 8.5A4.5 4.5 0 0 1 9.5 4h13A4.5 4.5 0 0 1 27 8.5v8a4.5 4.5 0 0 1-4.5 4.5H13l-7 5v-6.2A4.5 4.5 0 0 1 5 17Z"/><path d="M11 12h10M11 16h7"/>{christmas && <><path d="m6 7 4-5 5 4-2 4Z" fill="#b91c1c" stroke="#fff"/><path d="m6 7 5 1" stroke="#fff" strokeWidth="2.2"/><circle cx="14" cy="5" r="1.5" fill="#fff" stroke="none"/></>}</> :
    name === "home" ? <><path d="m3 14 13-10 13 10"/><path d="M6 12v15h20V12M13 27V17h7v10"/>{christmas && <><path d="m25 5 1.2 2.2 2.4.4-1.8 1.7.4 2.4-2.2-1.2-2.2 1.2.4-2.4-1.8-1.7 2.4-.4Z" fill="#eab308" stroke="none"/><path d="M5 14 2 11" stroke="#15803d" strokeWidth="3"/></>}</> :
    name === "notifications" ? <><path d="M24 21H8c1.8-2 2.5-4.1 2.5-8a5.5 5.5 0 0 1 11 0c0 3.9.7 6 2.5 8Z"/><path d="M13 25a3 3 0 0 0 6 0"/></> :
    name === "notes" ? <><path d="M7 4h12l6 6v17H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/><path d="M18 4v7h7M10 16h11M10 21h8"/>{christmas && <><path d="m5 5 2-3 2 3-2 3Z" fill="#15803d" stroke="none"/><circle cx="7" cy="5" r="1" fill="#dc2626" stroke="none"/></>}</> :
    <><circle cx="16" cy="11" r="5"/><path d="M6 28a10 10 0 0 1 20 0"/>{christmas && <><path d="m9 7 4-6 7 2 3 6-5 2-7-1Z" fill="#b91c1c" stroke="#fff" strokeWidth="1.2"/><path d="M9 7 20 9" stroke="#fff" strokeWidth="3"/><circle cx="21" cy="3" r="2" fill="#fff" stroke="none"/></>}</>}
  </svg>;
}

export default function StudentShell({ token, user, onLogout, request, onOpenGeneralAdmin, theme = "light", onToggleTheme, onSelectDisplayTheme }) {
  const [active, setActive] = useState("home");
  const dark = theme === "dark";
  const displayThemeLabels = { light: "Clair", dark: "Sombre", christmas: "Noël" };
  const [items, setItems] = useState([]);
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentViewMode, setDocumentViewMode] = useState(() => { try { return localStorage.getItem("ifac_document_view") === "list" ? "list" : "grid"; } catch { return "grid"; } });
  const [groups, setGroups] = useState([]);
  const [adminGroups, setAdminGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [messages, setMessages] = useState([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [feedback, setFeedback] = useState("");
  const [pdfViewer, setPdfViewer] = useState(null);
  const [flyerUpload, setFlyerUpload] = useState({ status: "empty", progress: 0, fileSignature: null, imageKey: null, mimeType: null });
  const flyerUploadAttempt = useRef(0);
  const [busy, setBusy] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [professorAssignments, setProfessorAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [adminCatalog, setAdminCatalog] = useState({ faculties: [], options: [], levels: [] });
  const [classList, setClassList] = useState([]);
  const [selectedClassKey, setSelectedClassKey] = useState("");
  const [classStudents, setClassStudents] = useState([]);
  const [classDocuments, setClassDocuments] = useState([]);
  const [cachedDocuments, setCachedDocuments] = useState([]);
  const [pendingClassDocuments, setPendingClassDocuments] = useState([]);
  const [adminDocuments, setAdminDocuments] = useState([]);
  const [adminAnnouncements, setAdminAnnouncements] = useState([]);
  const [canUploadAnnouncementFlyer, setCanUploadAnnouncementFlyer] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [serviceCounts, setServiceCounts] = useState({ class: 0, notifications: 0, classDocs: 0 });
  const [unreadDelegateCount, setUnreadDelegateCount] = useState(0);
  const [delegateMessages, setDelegateMessages] = useState([]);
  const [adminGroupMessages, setAdminGroupMessages] = useState([]);
  const [delegateMessageSubject, setDelegateMessageSubject] = useState("");
  const [delegateMessageBody, setDelegateMessageBody] = useState("");
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
  const [groupFacultyId, setGroupFacultyId] = useState("");
  const [groupOptionId, setGroupOptionId] = useState("");
  const [groupLevelId, setGroupLevelId] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("suggestion");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const page = destinations.find(x => x.id === active);

  async function load() {
    setBusy(true); setFeedback("");
    try {
      if (active === "home") {
        const [documentsResult, announcementsResult, notificationsResult, classDocumentsResult] = await Promise.all([
          request("/documents", { token }), request("/announcements", { token }), request("/notifications", { token }), request("/class-documents", { token })
        ]);
        setItems(documentsResult.data || []);
        setServiceCounts({ class: (announcementsResult.data || []).length, notifications: (notificationsResult.data || []).length, classDocs: (classDocumentsResult.data || []).length });
        setUnreadNotificationCount(notificationsResult.unreadCount ?? (notificationsResult.data || []).filter(x => !x.read_at).length);
      }
      if (active === "class") {
        const r = await request("/announcements", { token });
        if (user.role === "admin") { const adminResult = await request("/admin/announcements", { token }); setAdminAnnouncements(adminResult.data || []); setCanUploadAnnouncementFlyer(Boolean(adminResult.canUploadFlyers)); }
        const decorated = await Promise.all((r.data || []).map(async item => {
          if (!item.has_image) return item;
          try { const response = await fetch(apiUrl(`/api/v1/announcements/${item.id}/image`), { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) return item; return { ...item, imageUrl: URL.createObjectURL(await response.blob()) }; } catch { return item; }
        }));
        setItems(decorated);
      }
      if (active === "notes") { const r = await request("/notes", { token }); setItems(r.data || []); }
      if (active === "classDocs") {
        const requests = [request("/class-documents", { token })];
        if (user.role === "professor") requests.push(request("/professor/assignments", { token }));
        const [documentsResult, assignmentsResult] = await Promise.all(requests);
        setClassDocuments(documentsResult.data || []);
        if (assignmentsResult) setProfessorAssignments(assignmentsResult.data || []);
      }
      if (active === "notifications") { const r = await request("/notifications", { token }); setNotifications(r.data || []); setUnreadNotificationCount(r.unreadCount ?? (r.data || []).filter(x => !x.read_at).length); }
      if (active === "adminMessages" && user.role === "admin") { const [r,allMessages] = await Promise.all([request("/admin/delegate-messages", { token }),request("/admin/messages", { token })]); setDelegateMessages(r.data || []); setAdminGroupMessages(allMessages.data || []); setUnreadDelegateCount(r.unreadCount ?? (r.data || []).filter(x => !x.read_at).length); }
      if (active === "groupAdmin" && user.role === "admin") { const [catalog,groupResult] = await Promise.all([request("/admin/catalog", { token }),request("/admin/groups", { token })]); setAdminCatalog(catalog.data || { faculties: [], options: [], levels: [] }); setAdminGroups(groupResult.data || []); }
      if (active === "classAdmin" && user.role === "admin") {
        const [classesResult, pendingResult] = await Promise.all([
          request("/admin/classes", { token }), request("/admin/class-documents?status=all", { token })
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
          const [overview, subjectResult, catalog, docs, announcements, groupResult] = await Promise.all([request("/admin/overview", { token }), request("/admin/subjects", { token }), request("/admin/catalog", { token }), request("/admin/documents", { token }), request("/admin/announcements", { token }), request("/admin/groups", { token })]);
          setAdminStats(overview.data); setSubjects(subjectResult.data || []);
          setAdminCatalog(catalog.data || { faculties: [], options: [], levels: [] });
          setAdminDocuments(docs.data || []); setAdminAnnouncements(announcements.data || []); setCanUploadAnnouncementFlyer(Boolean(announcements.canUploadFlyers)); setAdminGroups(groupResult.data || []);
        } else if (user.role === "professor") {
          const r = await request("/professor/assignments", { token }); setProfessorAssignments(r.data || []);
        }
      }
    } catch (e) { setFeedback(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [active, selectedGroup, selectedClassKey]);
  useEffect(() => { if (isNativeApp()) listCachedNativeDocuments().then(setCachedDocuments).catch(() => {}); }, []);
  useEffect(() => () => { if (pdfViewer?.url) URL.revokeObjectURL(pdfViewer.url); }, [pdfViewer?.url]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r = await request("/notifications", { token }); if (alive) setUnreadNotificationCount(r.unreadCount ?? (r.data || []).filter(x => !x.read_at).length); } catch {}
      if (user.role === "admin") { try { const r = await request("/admin/delegate-messages", { token }); if (alive) setUnreadDelegateCount(r.unreadCount ?? (r.data || []).filter(x => !x.read_at).length); } catch {} }
    })();
    return () => { alive = false; };
  }, [token, user.role]);
  useEffect(() => () => { items.forEach(item => { if (item.imageUrl) URL.revokeObjectURL(item.imageUrl); }); }, [items]);
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
  async function sendDelegateMessage(e) {
    e.preventDefault(); setBusy(true); setFeedback("");
    try {
      const r = await request("/delegate/messages", { token, method: "POST", body: JSON.stringify({ subject: delegateMessageSubject, body: delegateMessageBody }) });
      setDelegateMessageSubject(""); setDelegateMessageBody(""); setFeedback(r.notice || "Message transmis à l’administration.");
    } catch (error) { setFeedback(error.message); } finally { setBusy(false); }
  }
  async function markDelegateMessageRead(id) {
    try { await request(`/admin/delegate-messages/${id}/read`, { token, method: "PATCH" }); setDelegateMessages(rows => rows.map(row => row.id === id ? { ...row, read_at: new Date().toISOString() } : row)); setUnreadDelegateCount(n=>Math.max(0,n-1)); }
    catch (error) { setFeedback(error.message); }
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
    try { await request(`/notifications/${id}/read`, { token, method: "PATCH" }); setNotifications(rows => rows.map(row => row.id === id ? { ...row, read_at: new Date().toISOString() } : row)); setUnreadNotificationCount(n=>Math.max(0,n-1)); }
    catch (error) { setFeedback(error.message); }
  }
  async function viewPdf(endpoint, title) {
    try {
      const response = await fetch(apiUrl(endpoint), { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || data.error || "Ouverture du PDF impossible."); }
      const blob = await response.blob();
      if (blob.type && blob.type !== "application/pdf") throw new Error("Le fichier reçu n’est pas un PDF valide.");
      setPdfViewer({ url: URL.createObjectURL(blob), title: title || "Lecture du document PDF" });
    } catch (error) { setFeedback(error.message); }
  }
  async function viewDocument(id, title) {
    if (isNativeApp()) {
      const cached = await getCachedNativeDocument(id, "library");
      if (cached) { setPdfViewer({ url: URL.createObjectURL(cached.blob), title: cached.title || title }); return; }
    }
    return viewPdf(`/api/v1/documents/${id}/download`, title);
  }
  async function viewClassDocument(id, title) {
    if (isNativeApp()) {
      const cached = await getCachedNativeDocument(id);
      if (cached) { setPdfViewer({ url: URL.createObjectURL(cached.blob), title: cached.title || title }); return; }
    }
    return viewPdf(`/api/v1/class-documents/${id}/download`, title);
  }
  async function downloadClassDocument(id, name) {
    try {
      const response = await fetch(apiUrl(`/api/v1/class-documents/${id}/download`), { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || data.error || "Téléchargement impossible."); }
      const blob = await response.blob();
      await cacheNativeDocument(id, name || `document-${id}.pdf`, blob);
      setCachedDocuments(await listCachedNativeDocuments());
      setFeedback("Document enregistré dans le cache de l’application. Il reste consultable hors connexion.");
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
  async function uploadAnnouncementFlyer(image) {
    const attempt = ++flyerUploadAttempt.current;
    const fileSignature = `${image.name}:${image.size}:${image.lastModified}`;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(image.type)) {
      setFlyerUpload({ status: "error", progress: 0, fileSignature, imageKey: null, mimeType: null });
      setFeedback("Format refusé. Choisissez une image PNG, JPG ou WebP.");
      return;
    }
    if (image.size < 1 || image.size > 8 * 1024 * 1024) {
      setFlyerUpload({ status: "error", progress: 0, fileSignature, imageKey: null, mimeType: null });
      setFeedback("L’image doit peser 8 Mo maximum.");
      return;
    }
    setFlyerUpload({ status: "uploading", progress: 0, fileSignature, imageKey: null, mimeType: image.type });
    setFeedback("Préparation du transfert de l’image…");
    try {
      const signed = await request("/admin/announcements/upload-token", {
        token, method: "POST", body: JSON.stringify({ contentType: image.type, fileSize: image.size })
      });
      const encodeMetadata = value => btoa(value);
      const metadata = [
        ["bucketName", signed.bucket],
        ["objectName", signed.imageKey],
        ["contentType", image.type],
        ["cacheControl", "3600"]
      ].map(([key, value]) => `${key} ${encodeMetadata(value)}`).join(",");
      const created = await fetch(signed.uploadEndpoint, {
        method: "POST",
        headers: {
          "Tus-Resumable": "1.0.0",
          apikey: signed.publishableKey,
          "Upload-Length": String(image.size),
          "Upload-Metadata": metadata,
          "x-signature": signed.token
        }
      });
      if (!created.ok) {
        const detail = await created.text().catch(() => "");
        throw new Error(`Le stockage a refusé de préparer l’image (HTTP ${created.status}). ${detail.slice(0, 180)}`);
      }
      const location = created.headers.get("Location");
      if (!location) throw new Error("Le stockage n’a pas confirmé le début du transfert.");
      const uploadUrl = new URL(location, signed.uploadEndpoint).toString();
      const chunkSize = 6 * 1024 * 1024;
      for (let offset = 0; offset < image.size;) {
        const end = Math.min(offset + chunkSize, image.size);
        const uploaded = await fetch(uploadUrl, {
          method: "PATCH",
          headers: {
            "Tus-Resumable": "1.0.0",
            apikey: signed.publishableKey,
            "x-signature": signed.token,
            "Upload-Offset": String(offset),
            "Content-Type": "application/offset+octet-stream"
          },
          body: image.slice(offset, end)
        });
        if (!uploaded.ok) {
          const detail = await uploaded.text().catch(() => "");
          throw new Error(`Le transfert a échoué (HTTP ${uploaded.status}). ${detail.slice(0, 180)}`);
        }
        offset = end;
        const progress = Math.round(offset / image.size * 100);
        if (attempt === flyerUploadAttempt.current) {
          setFlyerUpload({ status: "uploading", progress, fileSignature, imageKey: null, mimeType: image.type });
          setFeedback(`Transfert de l’image en cours : ${progress} %`);
        }
      }
      if (attempt !== flyerUploadAttempt.current) return;
      setFlyerUpload({ status: "ready", progress: 100, fileSignature, imageKey: signed.imageKey, mimeType: image.type });
      setFeedback("Image transférée avec succès. Vous pouvez maintenant publier l’annonce.");
    } catch (error) {
      if (attempt !== flyerUploadAttempt.current) return;
      setFlyerUpload({ status: "error", progress: 0, fileSignature, imageKey: null, mimeType: image.type });
      setFeedback(error.message || "Le transfert de l’image a échoué. Réessayez.");
    }
  }
  async function createAnnouncement(e) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    const hasImage = Boolean(flyerUpload.fileSignature);
    if (hasImage) {
      if (flyerUpload.status !== "ready" || !flyerUpload.imageKey) {
        setFeedback("Veuillez attendre la fin du transfert de l’image avant de publier l’annonce.");
        return;
      }
    }
    setBusy(true); setFeedback("");
    try {
      const payload = { title: String(form.get("title") || "").trim(), body: String(form.get("body") || "").trim() };
      if (hasImage) {
        payload.imageKey = flyerUpload.imageKey;
        payload.imageMimeType = flyerUpload.mimeType;
      }
      await request("/admin/announcements", { token, method: "POST", body: JSON.stringify(payload) });
      flyerUploadAttempt.current += 1;
      setFlyerUpload({ status: "empty", progress: 0, fileSignature: null, imageKey: null, mimeType: null });
      setAnnouncementTitle(""); setAnnouncementBody(""); formElement.reset(); setFeedback("Annonce publiée."); await load();
    } catch (error) { setFeedback(error.message); } finally { setBusy(false); }
  }
  async function editAnnouncement(item) {
    const title=window.prompt("Modifier le titre :",item.title); if(title===null) return;
    const body=window.prompt("Modifier le texte :",item.body); if(body===null) return;
    try { await request(`/admin/announcements/${item.id}`,{token,method:"PATCH",body:JSON.stringify({title,body})}); setFeedback("Annonce modifiée."); await load(); }
    catch(error){setFeedback(error.message);}
  }
  async function deleteAnnouncement(id) {
    if(!window.confirm("Supprimer cette annonce et son visuel ?")) return;
    try { await request(`/admin/announcements/${id}`,{token,method:"DELETE"}); setAdminAnnouncements(rows=>rows.filter(x=>x.id!==id)); setFeedback("Annonce supprimée."); await load(); }
    catch(error){setFeedback(error.message);}
  }
  async function editAdminDocument(item) {
    const title=window.prompt("Nouveau titre :",item.title); if(title===null||!title.trim()) return;
    try { await request(`/admin/documents/${item.id}`,{token,method:"PATCH",body:JSON.stringify({title,subjectId:item.subject_id})}); setFeedback("Document modifié."); await load(); }
    catch(error){setFeedback(error.message);}
  }
  async function editClassDocument(item) {
    const title=window.prompt("Titre :",item.title); if(title===null) return;
    const course=window.prompt("Cours / matière :",item.course||""); if(course===null) return;
    const professor=window.prompt("Professeur :",item.professor||""); if(professor===null) return;
    const description=window.prompt("Description :",item.description||""); if(description===null) return;
    try { await request(`/admin/class-documents/${item.id}`,{token,method:"PATCH",body:JSON.stringify({title,course,professor,description})}); setFeedback("Document de classe modifié."); await load(); }
    catch(error){setFeedback(error.message);}
  }
  async function deleteClassDocument(id) {
    if(!window.confirm("Supprimer ce document de classe ?")) return;
    try { await request(`/admin/class-documents/${id}`,{token,method:"DELETE"}); setPendingClassDocuments(rows=>rows.filter(x=>x.id!==id)); setFeedback("Document supprimé."); }
    catch(error){setFeedback(error.message);}
  }
  async function editDelegateMessage(item) {
    const subject=window.prompt("Objet :",item.subject); if(subject===null) return;
    const body=window.prompt("Modifier le message :",item.body); if(body===null) return;
    try { await request(`/admin/delegate-messages/${item.id}`,{token,method:"PATCH",body:JSON.stringify({subject,body})}); setDelegateMessages(rows=>rows.map(x=>x.id===item.id?{...x,subject,body}:x)); }
    catch(error){setFeedback(error.message);}
  }
  async function deleteDelegateMessage(id) {
    if(!window.confirm("Supprimer ce message ?")) return;
    try { await request(`/admin/delegate-messages/${id}`,{token,method:"DELETE"}); setDelegateMessages(rows=>rows.filter(x=>x.id!==id)); }
    catch(error){setFeedback(error.message);}
  }
  async function editGroupMessage(item) {
    const body=window.prompt("Modifier le message :",item.body); if(body===null||!body.trim()) return;
    try { await request(`/admin/messages/${item.id}`,{token,method:"PATCH",body:JSON.stringify({body})}); setMessages(rows=>rows.map(x=>x.id===item.id?{...x,body}:x)); setAdminGroupMessages(rows=>rows.map(x=>x.id===item.id?{...x,body}:x)); }
    catch(error){setFeedback(error.message);}
  }
  async function deleteGroupMessage(id) {
    if(!window.confirm("Supprimer ce message ?")) return;
    try { await request(`/admin/messages/${id}`,{token,method:"DELETE"}); setMessages(rows=>rows.filter(x=>x.id!==id)); setAdminGroupMessages(rows=>rows.filter(x=>x.id!==id)); }
    catch(error){setFeedback(error.message);}
  }
  async function createGroup(e) {
    e.preventDefault(); setBusy(true); setFeedback("");
    const body = { groupType, facultyId: groupFacultyId, optionId: groupType === "faculty" ? null : groupOptionId, studyLevelId: groupType === "class" ? groupLevelId : null };
    try { const result = await request("/admin/groups", { token, method: "POST", body: JSON.stringify(body) }); setFeedback(result.message || "Groupe créé et membres correspondants ajoutés."); await load(); }
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
      const response = await fetch(apiUrl(`/api/v1/documents/${id}/download`), { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { const r = await response.json().catch(() => ({})); throw new Error(r.message || r.error || "Téléchargement impossible."); }
      const blob = await response.blob();
      await cacheNativeDocument(id, title || `document-${id}`, blob, "library");
      setCachedDocuments(await listCachedNativeDocuments());
      setFeedback("Document enregistré dans le cache de l’application. Il reste consultable hors connexion.");
    } catch (e) { setFeedback(e.message); }
  }

  const headings = { home: ["Accueil", "Retrouvez ici tous les services de votre espace universitaire."], class: ["Annonces", "Informations publiées pour votre parcours."], classDocs: ["Documents de classe", "Consultez les supports de cours validés pour votre classe."], notifications: ["Notifications", "Les nouvelles ressources approuvées pour votre classe."], classAdmin: ["Gestion des classes", "Désignez les délégués et contrôlez les documents partagés."], professors: ["Gestion des professeurs", "Déclarez les adresses e-mail et gérez les affectations universitaires."], adminMessages: ["Messages des délégués", "Consultez les communications directes envoyées par les responsables de classe."], groupAdmin: ["Groupes de messagerie", "Créez les espaces de discussion de toutes les facultés, options et classes."], messages: ["Messagerie", "Messages des groupes auxquels votre compte appartient."], notes: ["Mes notes privées", "Ces notes ne sont accessibles qu’à votre compte."], profile: ["Mon profil", "Informations du compte et état des services."], courses: ["Gestion des cours", "Créez les cours à partir des matières et des niveaux existants."] };
  const visibleDestinations = destinations.filter(x => !x.adminOnly || user.role === "admin");
  const homeDestinations = visibleDestinations.filter(x => !["messages", "home", "notes", "profile"].includes(x.id));
  const profileImage = user.avatarUrl || user.avatar_url || user.profileImageUrl || user.profile_image_url || "";
  const assignedWorkspace = Array.isArray(user.workspaces)
    ? user.workspaces.find(workspace => workspace.role === user.role && workspace.universityName)
      || user.workspaces.find(workspace => workspace.universityName)
    : null;
  const displayUniversityName = assignedWorkspace?.universityName || user.universityName || "Université non renseignée";
  const normalizedDocumentSearch = documentSearch.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filteredDocuments = normalizedDocumentSearch
    ? items.filter(item => [item.title, item.subject, item.description, item.body, item.file_name, item.mime_type]
      .filter(Boolean).join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .includes(normalizedDocumentSearch))
    : items;
  const displayedItems = active === "home" ? filteredDocuments : items;
  const isDocumentCached = (kind, id) => cachedDocuments.some(doc => doc.kind === kind && String(doc.id) === String(id));
  function changeDocumentView(mode) { setDocumentViewMode(mode); try { localStorage.setItem("ifac_document_view", mode); } catch {} }
  const badgeCount = id => id === "notifications" ? unreadNotificationCount : id === "adminMessages" ? unreadDelegateCount : 0;
  const badgeText = count => count >= 100 ? "99+" : String(count);
  const serviceCount = id => id === "class" ? serviceCounts.class : id === "notifications" ? serviceCounts.notifications : id === "classDocs" ? serviceCounts.classDocs : badgeCount(id);
  return <main className={`student-app ${dark ? "student-dark" : "student-light"} student-theme-${theme}`}>
    {theme === "christmas" && <div className="christmas-atmosphere" aria-hidden="true"><span className="christmas-snow snow-one" /><span className="christmas-snow snow-two" /><span className="christmas-snow snow-three" /><span className="christmas-glow glow-one" /><span className="christmas-glow glow-two" /></div>}
    <header className="student-topbar"><a className="brand" href="#accueil" onClick={e => {e.preventDefault();setActive("home");}}><img className="brand-logo" src="/ifac-logo.svg" alt="" /><span>iFac <span className="brand-light">universite</span></span></a><div className="student-top-actions"><ThemeToggle theme={theme} onToggleTheme={onToggleTheme} /><span className="preview-pill">{user.firstName} {user.lastName}</span>{onOpenGeneralAdmin && <button className="subtle-button" onClick={onOpenGeneralAdmin}>Console générale</button>}<button className="subtle-button" onClick={onLogout}>Déconnexion</button></div></header>
    <div className="student-body"><aside className="student-sidebar" aria-label="Navigation principale"><p className="student-nav-caption">ESPACE ÉTUDIANT</p>{visibleDestinations.map(x => <button key={x.id} className={active === x.id ? "student-nav-item selected" : "student-nav-item"} onClick={() => setActive(x.id)}><span className={"nav-symbol nav-symbol-" + x.id}><NavigationIcon name={x.id} theme={theme} /></span><span>{x.label}</span>{badgeCount(x.id)>0 && <span className="nav-count">{badgeText(badgeCount(x.id))}</span>}</button>)}<div className="student-sidebar-note">{displayUniversityName}</div></aside>
      <section className="student-main" aria-live="polite"><div className="student-welcome"><div><p className="student-eyebrow">ESPACE UNIVERSITAIRE</p><h1>{headings[active][0]}</h1><p>{headings[active][1]}</p></div><span className="student-campus-badge">{displayUniversityName}</span></div>
        
        {active === "professors" && user.role === "admin" && <ProfessorManagement token={token} request={request} />}
        {active === "courses" && user.role === "admin" && <CourseManagement token={token} request={request} />}
        {active === "profile" && <div className="profile-page">
          <section className="profile-overview student-card">
            <div className="profile-avatar" aria-hidden="true">{profileImage ? <img src={profileImage} alt="" /> : (user.firstName || user.email || "U").trim().charAt(0).toUpperCase()}</div>
            <div className="profile-identity">
              <p className="profile-kicker">MON ESPACE PERSONNEL</p>
              <h2>{user.firstName} {user.lastName}</h2>
              <p>{user.email}</p>
              <span className="profile-role">{user.role === "admin" ? "Administrateur" : user.role === "delegate" ? "Délégué" : user.role === "professor" ? "Professeur" : "Étudiant"}</span>
            </div>
            <button className="subtle-button profile-logout" onClick={onLogout}>Déconnexion</button>
          </section>

          {active === "profile" && <nav className="mobile-dashboard profile-quick-access" aria-label="Accès rapides du profil">
          <div className="mobile-dashboard-heading"><span>MES SERVICES</span><small>Accès rapides depuis mon profil</small></div>
          <div className="mobile-dashboard-grid">
            {homeDestinations.map(x => <button key={x.id} type="button" className="mobile-dashboard-tile" onClick={() => setActive(x.id)}>
              <span className={"mobile-dashboard-icon nav-symbol-" + x.id}><NavigationIcon name={x.id} theme={theme} /></span>
              <span className="mobile-dashboard-label">{x.label}</span>
              {serviceCount(x.id)>0 && <span className="mobile-dashboard-count">{badgeText(serviceCount(x.id))} {x.id === "class" ? "annonce(s)" : x.id === "notifications" ? "notification(s)" : x.id === "classDocs" ? "document(s)" : "élément(s)"}</span>}
              <span className="mobile-dashboard-arrow" aria-hidden="true">›</span>
            </button>)}
          </div>
        </nav>}

          {user.role === "professor" && <section className="student-card"><h2>Mes affectations pédagogiques</h2>{professorAssignments.length ? <ul>{professorAssignments.map((a,i)=><li key={i}>{a.university_name} · {a.faculty_name} · {a.option_name} · {a.level_label}</li>)}</ul> : <p>Aucune affectation active n’est disponible.</p>}</section>}
          <div className="profile-summary-grid">
            <section className="student-card profile-info-card">
              <h2>Informations du compte</h2>
              <div className="profile-info-row"><span>Adresse e-mail</span><strong>{user.email}</strong></div>
              <div className="profile-info-row"><span>Rôle</span><strong>{user.role === "admin" ? "Administrateur" : user.role === "delegate" ? "Délégué" : user.role === "professor" ? "Professeur" : "Étudiant"}</strong></div>
              <div className="profile-info-row"><span>Université</span><strong>{displayUniversityName}</strong></div>
              <div className="profile-info-row"><span>Faculté / option</span><strong>{[user.facultyName, user.optionName].filter(Boolean).join(" · ") || "Non renseignée"}</strong></div>
              <div className="profile-info-row"><span>Niveau</span><strong>{user.studyLevelLabel || "Non renseigné"}</strong></div>
            </section>
            <section className="student-card profile-settings-card">
              <h2>Préférences d’affichage</h2>
              <p>Adaptez l’apparence de votre espace de travail.</p>
              <div className="profile-setting-control"><span><strong>Thème de l’interface</strong><small>Actuel : {displayThemeLabels[theme] || "Clair"}</small></span><div className="profile-theme-options"><button type="button" className={theme === "light" ? "theme-button selected" : "theme-button"} aria-pressed={theme === "light"} onClick={() => onSelectDisplayTheme?.("light")}>Clair</button><button type="button" className={theme === "dark" ? "theme-button selected" : "theme-button"} aria-pressed={theme === "dark"} onClick={() => onSelectDisplayTheme?.("dark")}>Sombre</button><button type="button" className={theme === "christmas" ? "theme-button selected theme-christmas" : "theme-button theme-christmas"} aria-pressed={theme === "christmas"} onClick={() => onSelectDisplayTheme?.("christmas")}><svg className="theme-art theme-art-christmas" viewBox="0 0 40 40" role="img" aria-label="Sapin de Noël"><path d="M19 3h3v6h-3z" fill="#8b5e3c"/><path d="m20 6 11 13h-6l9 10H6l9-10H9Z" fill="#15803d" stroke="#14532d" strokeWidth="1.3" strokeLinejoin="round"/><path d="M17 29h6v8h-6z" fill="#8b5e3c"/><path d="m20 11 1.3 2.5 2.7.4-2 1.9.5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-1.9 2.7-.4Z" fill="#facc15"/><circle cx="13" cy="25" r="1.6" fill="#dc2626"/><circle cx="27" cy="24" r="1.6" fill="#dc2626"/><circle cx="20" cy="31" r="1.6" fill="#facc15"/></svg><span>Noël</span></button></div></div>
            </section>
          </div>

          {user.role === "admin" && <section className="profile-admin-section">
            <div className="profile-section-heading"><div><p className="profile-kicker">CENTRE DE CONTRÔLE</p><h2>Administration iFac</h2><p>Retrouvez les outils de gestion dans des espaces distincts.</p></div></div>
            {adminStats && <div className="profile-stats-grid">
              <article className="profile-stat-card"><span>Utilisateurs</span><strong>{adminStats.users ?? 0}</strong></article>
              <article className="profile-stat-card"><span>Documents</span><strong>{adminStats.documents ?? 0}</strong></article>
              <article className="profile-stat-card"><span>Annonces</span><strong>{adminStats.announcements ?? 0}</strong></article>
            </div>}
            <div className="profile-admin-grid">
              <form className="student-card note-form profile-tool-card" onSubmit={uploadDocument}>
                <div className="profile-tool-heading"><span className="profile-tool-icon">PDF</span><div><h3>Bibliothèque documentaire</h3><p>Ajouter une ressource officielle.</p></div></div>
                <label className="field">Matière<select name="subjectId" required defaultValue=""><option value="">Choisir la matière</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name} — {s.option_name} / {s.level_label}</option>)}</select></label>
                <label className="field">Titre du document<input name="title" maxLength="220" required placeholder="Ex. : Introduction à la psychopédagogie" /></label>
                <label className="field">Fichier PDF<input name="file" type="file" accept="application/pdf,.pdf" required /></label>
                <p className="profile-helper">PDF uniquement · 15 Mo maximum · stockage privé.</p>
                <button className="theme-button" disabled={busy}>Ajouter le document</button>
              </form>

              <section className="student-card note-form profile-tool-card"><div className="profile-tool-heading"><span className="profile-tool-icon">DOC</span><div><h3>Modifier les documents</h3><p>Renommer ou retirer les documents de la bibliothèque officielle.</p></div></div>{adminDocuments.length===0?<p>Aucun document enregistré.</p>:adminDocuments.map(item=><article className="student-data-item" key={item.id}><strong>{item.title}</strong><p>{item.subject}</p><div className="admin-review-actions"><button type="button" className="theme-button" onClick={()=>editAdminDocument(item)}>Modifier</button><button type="button" className="theme-button" onClick={()=>deleteDocument(item.id)}>Supprimer</button></div></article>)}</section>
              <form className="student-card note-form profile-tool-card" onSubmit={createSubject}>
                <div className="profile-tool-heading"><span className="profile-tool-icon">MAT</span><div><h3>Catalogue des matières</h3><p>Créer une matière pour un parcours.</p></div></div>
                <label className="field">Faculté<select required value={adminFacultyId} onChange={e => { setAdminFacultyId(e.target.value); setAdminOptionId(""); setAdminLevelId(""); }}><option value="">Choisir la faculté</option>{adminCatalog.faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
                <label className="field">Option<select required value={adminOptionId} onChange={e => { setAdminOptionId(e.target.value); setAdminLevelId(""); }} disabled={!adminFacultyId}><option value="">Choisir l’option</option>{adminCatalog.options.filter(o => String(o.faculty_id) === String(adminFacultyId)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
                <label className="field">Niveau<select required value={adminLevelId} onChange={e => setAdminLevelId(e.target.value)} disabled={!adminOptionId}><option value="">Choisir le niveau</option>{adminCatalog.levels.filter(l => String(l.option_id) === String(adminOptionId)).map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
                <label className="field">Nom de la matière<input value={subjectName} onChange={e => setSubjectName(e.target.value)} maxLength="180" required placeholder="Nom de la matière" /></label>
                <button className="theme-button" disabled={busy}>Créer la matière</button>
              </form>

              <form className="student-card note-form profile-tool-card" onSubmit={createAnnouncement}>
                <div className="profile-tool-heading"><span className="profile-tool-icon">INFO</span><div><h3>Communication</h3><p>Publier une annonce générale.</p></div></div>
                <label className="field">Titre de l’annonce<input value={announcementTitle} onChange={e => setAnnouncementTitle(e.target.value)} name="title" maxLength="220" required placeholder="Titre clair et concis" /></label>
                <label className="field">Message<textarea value={announcementBody} onChange={e => setAnnouncementBody(e.target.value)} name="body" maxLength="20000" rows="4" required placeholder="Rédigez votre annonce…" /></label>
                {canUploadAnnouncementFlyer && <label className="field">Flyer / image de l’annonce<input name="image" type="file" accept="image/png,image/jpeg,image/webp" disabled={flyerUpload.status === "uploading" || busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) uploadAnnouncementFlyer(file); else { flyerUploadAttempt.current += 1; setFlyerUpload({ status: "empty", progress: 0, fileSignature: null, imageKey: null, mimeType: null }); } }} /></label>}{canUploadAnnouncementFlyer && flyerUpload.status === "uploading" && <p className="profile-helper" role="status">Transfert de l’image : {flyerUpload.progress} %. Le bouton de publication restera bloqué jusqu’à la fin.</p>}{canUploadAnnouncementFlyer && flyerUpload.status === "ready" && <p className="profile-helper" role="status">Image prête. Vous pouvez publier l’annonce.</p>}{canUploadAnnouncementFlyer && flyerUpload.status === "error" && <p className="profile-helper" role="alert">Le transfert a échoué. Sélectionnez à nouveau l’image pour réessayer.</p>}<p className="profile-helper">{canUploadAnnouncementFlyer ? "PNG, JPG ou WebP · 8 Mo maximum. Réservé au compte principal iFac." : "L’ajout de flyers est réservé au compte principal iFac."}</p>
                <button className="theme-button" disabled={busy || flyerUpload.status === "uploading" || (Boolean(flyerUpload.fileSignature) && flyerUpload.status !== "ready")}>{flyerUpload.status === "uploading" ? `Transfert ${flyerUpload.progress} %…` : "Publier l’annonce"}</button>
              </form>


            </div>
          </section>}

          <form className="student-card note-form profile-feedback-card" onSubmit={submitFeedback}>
            <div><p className="profile-kicker">VOTRE CONTRIBUTION</p><h2>Contacter l’équipe iFac</h2><p>Envoyez une suggestion, une question ou une évaluation.</p></div>
            <div className="profile-feedback-fields">
              <label className="field">Type de retour<select value={feedbackCategory} onChange={e => setFeedbackCategory(e.target.value)}><option value="suggestion">Suggestion</option><option value="question">Question</option><option value="rating">Évaluation</option></select></label>
              <label className="field">Votre message<textarea value={feedbackMessage} onChange={e => setFeedbackMessage(e.target.value)} maxLength="5000" rows="3" required placeholder="Décrivez votre retour…" /></label>
            </div>
            <button className="theme-button" disabled={busy}>Envoyer mon avis</button>
          </form>
        </div>}
        {active === "class" && user.role === "admin" && <section className="student-card student-data-list"><h2>Gérer les annonces</h2>{adminAnnouncements.map(item => <article className="student-data-item" key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>{item.has_image ? "Visuel joint" : "Sans visuel"}</small><div className="admin-review-actions"><button className="theme-button" onClick={() => editAnnouncement(item)}>Modifier</button><button className="theme-button" onClick={() => deleteAnnouncement(item.id)}>Supprimer</button></div></article>)}</section>}
        {active === "classDocs" && <>
          {isNativeApp() && cachedDocuments.length > 0 && <section className="student-card student-data-list"><h2>Documents enregistrés dans l’application</h2><p>Ces fichiers restent accessibles sans connexion Internet.</p>{cachedDocuments.map(doc => <article className="student-data-item" key={`${doc.kind}:${doc.id}`}><strong>{doc.title}</strong><small>Disponible hors connexion · {new Date(doc.cachedAt).toLocaleString()}</small><button className="theme-button" type="button" onClick={async () => { const cached = await getCachedNativeDocument(doc.id, doc.kind); if (cached) setPdfViewer({ url: URL.createObjectURL(cached.blob), title: cached.title }); }}>Ouvrir le document</button></article>)}</section>}
          {(user.role === "delegate" || user.role === "professor") && <form className="student-card note-form" onSubmit={uploadClassDocument}>
            <h2>Publier une ressource pédagogique</h2>
            <p>{user.role === "professor" ? "La publication est limitée aux cours qui vous ont été attribués." : "Votre document sera partagé avec les étudiants de votre classe."}</p>
            <label className="field">Titre du document<input name="title" required maxLength="220" value={classDocTitle} onChange={e=>setClassDocTitle(e.target.value)} placeholder="Titre du document" /></label>
            {user.role === "professor" ? <>
              <label className="field">Cours attribué<select name="courseId" required value={classDocCourse} onChange={e=>setClassDocCourse(e.target.value)}><option value="">Choisir un cours</option>{professorAssignments.filter(a=>a.course_id).map(a=><option key={a.course_id} value={a.course_id}>{a.course_name} · {a.option_name} · {a.level_label}</option>)}</select></label>
              <input type="hidden" name="course" value={professorAssignments.find(a=>String(a.course_id)===String(classDocCourse))?.course_name || ""} />
            </> : <label className="field">Matière<input name="course" required maxLength="180" value={classDocCourse} onChange={e=>setClassDocCourse(e.target.value)} placeholder="Nom exact de la matière" /></label>}
            <label className="field">Nom du professeur (facultatif)<input name="professor" maxLength="180" value={classDocProfessor} onChange={e=>setClassDocProfessor(e.target.value)} /></label>
            <label className="field">Description (facultative)<textarea name="description" maxLength="3000" rows="3" value={classDocDescription} onChange={e=>setClassDocDescription(e.target.value)} /></label>
            <label className="field">Fichier PDF<input name="file" type="file" accept="application/pdf,.pdf" required /></label>
            <button className="theme-button" disabled={busy || (user.role === "professor" && !professorAssignments.some(a=>String(a.course_id)===String(classDocCourse)))}>Publier le document</button>
          </form>}
          <div className="document-toolbar class-document-toolbar"><strong>Documents approuvés pour ma classe ou mes cours</strong><div className="document-view-switch" role="group" aria-label="Mode d’affichage"><button type="button" className={documentViewMode === "grid" ? "selected" : ""} aria-pressed={documentViewMode === "grid"} onClick={() => changeDocumentView("grid")}>Carré</button><button type="button" className={documentViewMode === "list" ? "selected" : ""} aria-pressed={documentViewMode === "list"} onClick={() => changeDocumentView("list")}>En ligne</button></div></div><section className={`student-card student-data-list class-document-library ${documentViewMode === "grid" ? "document-grid-mode" : "document-list-mode"}`}>{classDocuments.length === 0 ? <p>Aucun document approuvé pour le moment.</p> : classDocuments.map(item => <article className="student-data-item" key={item.id}><strong>{item.title}</strong><p>{item.course} {item.professor ? `· ${item.professor}` : ""}</p>{item.description && <p>{item.description}</p>}<div className="document-cover-row"><PdfCoverPreview id={item.id} title={item.title} token={token} endpoint={`/api/v1/class-documents/${item.id}/download`} compact={documentViewMode === "list"} /><div className="document-cover-details"><strong>{item.title}</strong><p>{item.course} {item.professor ? `· ${item.professor}` : ""}</p>{item.description && <p>{item.description}</p>}<button className="theme-button" onClick={() => viewClassDocument(item.id,item.title)}>Lire le PDF</button>{isNativeApp() && !isDocumentCached("class", item.id) && <button className="theme-button" onClick={() => downloadClassDocument(item.id,item.file_name)}>Télécharger dans l’application</button>}{isNativeApp() && isDocumentCached("class", item.id) && <small className="cached-document-label">Déjà disponible hors connexion</small>}</div></div></article>)}</section>
        </>}
        {active === "groupAdmin" && user.role === "admin" && <div className="profile-tools-grid">              <form className="student-card note-form profile-tool-card" onSubmit={createGroup}>
                <div className="profile-tool-heading"><span className="profile-tool-icon">GROUPE</span><div><h3>Groupes de messagerie</h3><p>Créer un groupe selon le parcours.</p></div></div>
                <label className="field">Portée du groupe<select value={groupType} onChange={e => setGroupType(e.target.value)}><option value="faculty">Toute ma faculté</option><option value="option">Mon option</option><option value="class">Mon niveau / ma classe</option></select></label>
                <label className="field">Faculté<select required value={groupFacultyId} onChange={e => { setGroupFacultyId(e.target.value); setGroupOptionId(""); setGroupLevelId(""); }}><option value="">Choisir une faculté</option>{adminCatalog.faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
                {groupType !== "faculty" && <label className="field">Option<select required value={groupOptionId} onChange={e => { setGroupOptionId(e.target.value); setGroupLevelId(""); }} disabled={!groupFacultyId}><option value="">Choisir une option</option>{adminCatalog.options.filter(o => String(o.faculty_id) === String(groupFacultyId)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
                {groupType === "class" && <label className="field">Niveau<select required value={groupLevelId} onChange={e => setGroupLevelId(e.target.value)} disabled={!groupOptionId}><option value="">Choisir un niveau</option>{adminCatalog.levels.filter(l => String(l.option_id) === String(groupOptionId)).map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>}
                <p className="profile-helper">Sélectionnez une faculté parmi toutes celles de l’université, puis une option et un niveau si nécessaire. Les étudiants et délégués vérifiés correspondant au parcours seront ajoutés automatiquement. Les nouveaux inscrits rejoindront aussi les groupes correspondant à leur profil.</p>
                <button className="theme-button" disabled={busy || !groupFacultyId || (groupType !== "faculty" && !groupOptionId) || (groupType === "class" && !groupLevelId)}>Créer le groupe</button>
              </form>
              <section className="student-card student-data-list profile-tool-card"><div className="profile-tool-heading"><span className="profile-tool-icon">CHAT</span><div><h3>Groupes créés</h3><p>Groupes de toutes les facultés, options et classes de l’université.</p></div></div>{adminGroups.length===0?<p>Aucun groupe créé pour le moment.</p>:adminGroups.map(g=><article className="student-data-item" key={g.id}><strong>{g.faculty_name || "Faculté"}{g.option_name ? " · "+g.option_name : ""}{g.study_level_label ? " · "+g.study_level_label : ""}</strong><p>{g.group_type==="faculty"?"Groupe de faculté":g.group_type==="option"?"Groupe d’option":"Groupe de niveau / classe"} · {g.member_count} membre(s)</p></article>)}</section></div>}
        {active === "adminMessages" && user.role === "admin" && <section className="student-card student-data-list"><h2>Boîte de réception des délégués</h2>{delegateMessages.length === 0 ? <p>Aucun message reçu des délégués.</p> : delegateMessages.map(m => <article className="student-data-item" key={m.id}><strong>{m.subject}</strong><p>{m.body}</p><small>{m.first_name} {m.last_name} · {m.email} · {m.faculty_name || "Faculté"} · {m.option_name || "Option"} · {m.study_level_label || "Niveau"}</small><small>{new Date(m.created_at).toLocaleString()} · {m.read_at ? "Lu" : "Non lu"}</small>{!m.read_at && <button className="theme-button" onClick={() => markDelegateMessageRead(m.id)}>Marquer comme lu</button>}<button className="theme-button" onClick={() => editDelegateMessage(m)}>Modifier</button><button className="theme-button" onClick={() => deleteDelegateMessage(m.id)}>Supprimer</button></article>)}</section>}
        {active === "adminMessages" && user.role === "admin" && <section className="student-card student-data-list"><h2>Messages des groupes</h2>{adminGroupMessages.length===0?<p>Aucun message de groupe.</p>:adminGroupMessages.map(m=><article className="student-data-item" key={m.id}><strong>{m.first_name} {m.last_name} · Groupe {m.group_id}</strong><p>{m.body}</p><small>{new Date(m.created_at).toLocaleString()}</small><div className="admin-review-actions"><button className="theme-button" onClick={()=>editGroupMessage(m)}>Modifier</button><button className="theme-button" onClick={()=>deleteGroupMessage(m.id)}>Supprimer</button></div></article>)}</section>}
        {active === "notifications" && <section className="student-card student-data-list"><h2>Mes notifications</h2>{notifications.length === 0 ? <p>Aucune notification pour le moment.</p> : notifications.map(item => <article className="student-data-item" key={item.id}><strong>{item.title}</strong><p>Un document a été approuvé pour le cours : {item.course}</p><small>{new Date(item.created_at).toLocaleString()} · {item.read_at ? "Lue" : "Non lue"}</small>{!item.read_at && <button className="theme-button" onClick={() => markNotificationRead(item.id)}>Marquer comme lue</button>}</article>)}</section>}
        {active === "classAdmin" && user.role === "admin" && <><section className="student-card note-form"><h2>Classes de l’université</h2><label className="field">Sélectionner une classe<select value={selectedClassKey} onChange={e => setSelectedClassKey(e.target.value)}><option value="">Choisir une classe</option>{classList.map(c => { const key = [c.university_id,c.faculty_id,c.option_id,c.study_level_id].join(":"); return <option key={key} value={key}>{c.faculty_name} · {c.option_name} · {c.study_level_label}</option>; })}</select></label>{classList.find(c => [c.university_id,c.faculty_id,c.option_id,c.study_level_id].join(":") === selectedClassKey) && <p>Étudiants : {classList.find(c => [c.university_id,c.faculty_id,c.option_id,c.study_level_id].join(":") === selectedClassKey).student_count} · Délégués : {classList.find(c => [c.university_id,c.faculty_id,c.option_id,c.study_level_id].join(":") === selectedClassKey).delegate_count} / 3</p>}</section><section className="student-card student-data-list"><h2>Étudiants et délégués</h2>{classStudents.length === 0 ? <p>Aucun étudiant trouvé pour cette classe.</p> : classStudents.map(student => <article className="student-data-item" key={student.id}><strong>{student.first_name} {student.last_name}</strong><p>{student.email} · {student.role}</p>{student.role === "delegate" ? <button className="theme-button" onClick={() => removeDelegate(student.id)} disabled={busy}>Retirer le rôle</button> : <button className="theme-button" onClick={() => assignDelegate(student.id)} disabled={busy || (classList.find(c => [c.university_id,c.faculty_id,c.option_id,c.study_level_id].join(":") === selectedClassKey)?.delegate_count || 0) >= 3}>Désigner délégué</button>}</article>)}</section><section className="student-card student-data-list"><h2>Gestion des documents de classe</h2>{pendingClassDocuments.length === 0 ? <p>Aucun document publié pour le moment.</p> : pendingClassDocuments.map(doc => <article className="student-data-item" key={doc.id}><strong>{doc.title}</strong><p>{doc.course} · {doc.uploader_first_name} {doc.uploader_last_name}</p><small>{doc.faculty_name} · {doc.option_name} · {doc.study_level_label} · Statut : {doc.status === "pending" ? "À examiner" : doc.status === "approved" ? "Publié" : "Refusé"}</small><div className="admin-review-actions"><button className="theme-button" onClick={() => viewClassDocument(doc.id,doc.title)}>Consulter le PDF</button><button className="theme-button" onClick={() => editClassDocument(doc)} disabled={busy}>Modifier</button>{doc.status === "pending" && <><button className="theme-button" onClick={() => reviewClassDocument(doc.id,"approved")} disabled={busy}>Publier</button><button className="theme-button" onClick={() => reviewClassDocument(doc.id,"rejected")} disabled={busy}>Refuser</button></>}<button className="theme-button" onClick={() => deleteClassDocument(doc.id)} disabled={busy}>Supprimer</button></div></article>)}</section></>}
        {active === "notes" && <form className="student-card note-form" onSubmit={saveNote}><h2>Ajouter une note</h2><input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Titre de la note" maxLength="180" required /><textarea value={noteBody} onChange={e => setNoteBody(e.target.value)} placeholder="Écrire votre note privée…" maxLength="50000" rows="4" /><button className="theme-button" disabled={busy}>Enregistrer la note</button></form>}
        {active === "messages" && groups.length > 0 && <div className="student-card"><label>Groupe <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>{groups.map(g => <option key={g.id} value={g.id}>{g.faculty_name || "Faculté"}{g.option_name ? " · "+g.option_name : ""}{g.study_level_label ? " · "+g.study_level_label : ""}</option>)}</select></label><div className="student-data-list">{messages.map(m => <article className="student-data-item" key={m.id}><strong>{m.first_name} {m.last_name}</strong><p>{m.body}</p><small>{new Date(m.created_at).toLocaleString()}</small>{user.role === "admin" && <div className="admin-review-actions"><button className="theme-button" onClick={() => editGroupMessage(m)}>Modifier</button><button className="theme-button" onClick={() => deleteGroupMessage(m.id)}>Supprimer</button></div>}</article>)}</div><form onSubmit={sendMessage}><textarea value={messageBody} onChange={e => setMessageBody(e.target.value)} placeholder="Votre message…" maxLength="5000" required /><button className="theme-button">Envoyer</button></form></div>}
        {busy && <p role="status">Chargement…</p>}{feedback && <p className="form-feedback" role="status">{feedback}</p>}
        {active === "home" && <div className="document-search-sticky"><section className="student-card document-search-card">
          <label className="field" htmlFor="document-search">Rechercher dans les documents</label>
          <div className="document-search-control">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>
            <input id="document-search" type="search" value={documentSearch} onChange={e => setDocumentSearch(e.target.value)} placeholder="Titre, matière, description…" autoComplete="off" />
          </div>
          <div className="document-toolbar"><p className="document-search-count" aria-live="polite">{filteredDocuments.length} document{filteredDocuments.length > 1 ? "s" : ""} trouvé{filteredDocuments.length > 1 ? "s" : ""}</p><div className="document-view-switch" role="group" aria-label="Mode d’affichage"><button type="button" className={documentViewMode === "grid" ? "selected" : ""} aria-pressed={documentViewMode === "grid"} onClick={() => changeDocumentView("grid")}>Carré</button><button type="button" className={documentViewMode === "list" ? "selected" : ""} aria-pressed={documentViewMode === "list"} onClick={() => changeDocumentView("list")}>En ligne</button></div></div>
        </section></div>}
        {active !== "profile" && active !== "notes" && active !== "messages" && active !== "groupAdmin" && <section className={active === "home" ? `student-card student-data-list document-library ${documentViewMode === "grid" ? "document-grid-mode" : "document-list-mode"}` : "student-card student-data-list"}>{displayedItems.length === 0 && !busy ? <p>{active === "home" && documentSearch.trim() ? "Aucun document ne correspond à votre recherche." : active === "home" ? "Aucun document disponible pour le moment." : "Aucun élément disponible pour le moment."}</p> : displayedItems.map(item => <article className="student-data-item" key={item.id}>{active === "home" && <PdfCoverPreview id={item.id} title={item.title} token={token} endpoint={`/api/v1/documents/${item.id}/download`} compact={documentViewMode === "list"} />}{item.imageUrl && <img className="announcement-flyer" src={item.imageUrl} alt="Visuel de l’annonce" />}<div className="document-item-content"><strong title={item.title}>{item.title}</strong>{item.subject && <p>Matière : {item.subject}</p>}<p>{item.body || (item.mime_type ? `${item.mime_type} · ${Math.round(Number(item.file_size_bytes || 0)/1024)} Ko` : "")}</p><small>{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</small>{active === "home" && <><button className="theme-button" onClick={() => viewDocument(item.id, item.title)}>Lire le PDF</button>{isNativeApp() && !isDocumentCached("library", item.id) && <button className="theme-button" onClick={() => downloadDocument(item.id, item.title)}>Télécharger dans l’application</button>}{isNativeApp() && isDocumentCached("library", item.id) && <small className="cached-document-label">Déjà disponible hors connexion</small>}{user.role === "admin" && <button className="theme-button" onClick={() => deleteDocument(item.id)}>Retirer le document</button>}</>}</div></article>)}</section>}
        
        {active === "notes" && <section className="student-card student-data-list">{items.length === 0 && !busy ? <p>Aucune note enregistrée.</p> : items.map(item => <article className="student-data-item" key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>Modifiée : {new Date(item.updated_at).toLocaleString()}</small><button className="theme-button" onClick={() => deleteNote(item.id)}>Supprimer</button></article>)}</section>}
        {active === "messages" && groups.length === 0 && !busy && <section className="student-card"><p>Aucun groupe de messagerie ne vous est encore attribué.</p></section>}
      </section></div>
    <nav className="student-mobile-nav" aria-label="Navigation principale">
      <button type="button" className={active === "home" || !["messages","notifications","profile","notes"].includes(active) ? "mobile-nav-item selected" : "mobile-nav-item"} aria-current={active === "home" ? "page" : undefined} aria-label="Accueil" title="Accueil" onClick={() => setActive("home")}><span className="mobile-nav-symbol"><NavigationIcon name="home" theme={theme} /></span><span className="mobile-nav-label">Accueil</span></button>
      <button type="button" className={active === "messages" ? "mobile-nav-item selected" : "mobile-nav-item"} aria-current={active === "messages" ? "page" : undefined} aria-label="Messagerie" title="Messagerie" onClick={() => setActive("messages")}><span className="mobile-nav-symbol"><NavigationIcon name="messages" theme={theme} /></span><span className="mobile-nav-label">Messagerie</span></button>
      <button type="button" className={active === "notes" ? "mobile-nav-item mobile-nav-create selected" : "mobile-nav-item mobile-nav-create"} aria-current={active === "notes" ? "page" : undefined} aria-label="Créer une note" title="Créer une note" onClick={() => setActive("notes")}><span className="mobile-nav-symbol mobile-nav-create-symbol"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 7v18M7 16h18" /></svg></span><span className="mobile-nav-label">Créer</span></button>
      <button type="button" className={active === "notifications" ? "mobile-nav-item selected" : "mobile-nav-item"} aria-current={active === "notifications" ? "page" : undefined} aria-label="Notifications" title="Notifications" onClick={() => setActive("notifications")}><span className="mobile-nav-symbol"><NavigationIcon name="notifications" theme={theme} /></span><span className="mobile-nav-label">Notifications</span>{badgeCount("notifications")>0 && <span className="nav-count">{badgeText(badgeCount("notifications"))}</span>}</button>
      <button type="button" className={active === "profile" ? "mobile-nav-item selected" : "mobile-nav-item"} aria-current={active === "profile" ? "page" : undefined} aria-label="Profil" title="Profil" onClick={() => setActive("profile")}>{profileImage ? <img className="mobile-nav-avatar" src={profileImage} alt="" /> : <span className="mobile-nav-symbol"><NavigationIcon name="profile" theme={theme} /></span>}<span className="mobile-nav-label">Profil</span></button>
    </nav>
    {pdfViewer && <div className="pdf-reader-overlay" role="dialog" aria-modal="true" aria-label="Lecteur PDF"><section className="pdf-reader-panel"><header className="pdf-reader-header"><div><strong>{pdfViewer.title}</strong><small>Lecteur PDF intégré à iFacuniversite</small></div><button type="button" className="theme-button" onClick={() => setPdfViewer(null)}>Fermer</button></header><iframe className="pdf-reader-frame" src={pdfViewer.url} title={pdfViewer.title} /></section></div>}
  </main>;
}
