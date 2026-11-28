import { useEffect, useState } from "react";
import { readCatalogCache, writeCatalogCache } from "./catalogCache.js";

export default function AcademicCourseRequestFields({
  value,
  onChange,
  request,
  variant = "auth",
  heading = "Demande de cours",
  removable = false,
  onRemove
}) {
  const [universities, setUniversities] = useState(() => readCatalogCache("/catalog/professor-universities") ?? []);
  const [loadingUniversities, setLoadingUniversities] = useState(() => readCatalogCache("/catalog/professor-universities") === null);
  const [faculties, setFaculties] = useState([]);
  const [options, setOptions] = useState([]);
  const [levels, setLevels] = useState([]);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");

  async function loadCatalog(path, setter, message, isCancelled, onFinally) {
    const cached = readCatalogCache(path);
    if (cached !== null && !isCancelled()) setter(cached);
    try {
      const result = await request(path);
      if (!Array.isArray(result?.data)) throw new Error("invalid_catalog_response");
      if (!isCancelled()) {
        setter(result.data);
        writeCatalogCache(path, result.data);
        setError("");
      }
    } catch {
      if (!isCancelled()) {
        if (cached === null) setter([]);
        // A valid local list is a usable offline result, not a blocking error.
        setError(cached !== null ? "" : message);
      }
    } finally {
      if (!isCancelled()) onFinally?.();
    }
  }

  useEffect(() => {
    let cancelled = false;
    loadCatalog("/catalog/professor-universities", setUniversities, "Impossible de charger le catalogue des universités.", () => cancelled, () => setLoadingUniversities(false));
    return () => { cancelled = true; };
  }, [request]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let lastRefreshAt = Date.now();
    const refresh = (force = false) => {
      if (cancelled || inFlight || document.visibilityState === "hidden" || (!force && Date.now() - lastRefreshAt < 300000)) return;
      inFlight = true;
      lastRefreshAt = Date.now();
      loadCatalog("/catalog/professor-universities", setUniversities, "Impossible de charger le catalogue des universités.", () => cancelled)
        .finally(() => { inFlight = false; });
    };
    const onFocus = () => window.setTimeout(() => refresh(false), 1200);
    const onVisibility = () => { if (document.visibilityState === "visible") window.setTimeout(() => refresh(false), 1200); };
    const onOnline = () => window.setTimeout(() => refresh(true), 800);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [request]);

  useEffect(() => {
    let cancelled = false;
    setFaculties([]); setOptions([]); setLevels([]); setCourses([]);
    if (!value.universityId) return undefined;
    loadCatalog("/catalog/faculties?universityId=" + encodeURIComponent(value.universityId), setFaculties, "Impossible de charger les facultés de cette université.", () => cancelled);
    return () => { cancelled = true; };
  }, [request, value.universityId]);

  useEffect(() => {
    let cancelled = false;
    setOptions([]); setLevels([]); setCourses([]);
    if (!value.facultyId) return undefined;
    loadCatalog("/catalog/options?facultyId=" + encodeURIComponent(value.facultyId), setOptions, "Impossible de charger les programmes de cette faculté.", () => cancelled);
    return () => { cancelled = true; };
  }, [request, value.facultyId]);

  useEffect(() => {
    let cancelled = false;
    setLevels([]); setCourses([]);
    if (!value.optionId) return undefined;
    loadCatalog("/catalog/levels?optionId=" + encodeURIComponent(value.optionId), setLevels, "Impossible de charger les niveaux de ce programme.", () => cancelled);
    return () => { cancelled = true; };
  }, [request, value.optionId]);

  useEffect(() => {
    let cancelled = false;
    setCourses([]);
    if (!value.studyLevelId) return undefined;
    loadCatalog("/catalog/courses?studyLevelId=" + encodeURIComponent(value.studyLevelId), setCourses, "Impossible de charger les cours de ce niveau.", () => cancelled);
    return () => { cancelled = true; };
  }, [request, value.studyLevelId]);

  // When connectivity returns, refresh only the small catalog lists currently in use.
  useEffect(() => {
    let cancelled = false;
    const refreshSelectedLists = () => {
      if (cancelled) return;
      if (value.universityId) {
        loadCatalog("/catalog/faculties?universityId=" + encodeURIComponent(value.universityId), setFaculties, "Impossible de charger les facultés de cette université.", () => cancelled);
      }
      if (value.facultyId) {
        loadCatalog("/catalog/options?facultyId=" + encodeURIComponent(value.facultyId), setOptions, "Impossible de charger les programmes de cette faculté.", () => cancelled);
      }
      if (value.optionId) {
        loadCatalog("/catalog/levels?optionId=" + encodeURIComponent(value.optionId), setLevels, "Impossible de charger les niveaux de ce programme.", () => cancelled);
      }
      if (value.studyLevelId) {
        loadCatalog("/catalog/courses?studyLevelId=" + encodeURIComponent(value.studyLevelId), setCourses, "Impossible de charger les cours de ce niveau.", () => cancelled);
      }
    };
    window.addEventListener("online", refreshSelectedLists);
    return () => {
      cancelled = true;
      window.removeEventListener("online", refreshSelectedLists);
    };
  }, [request, value.universityId, value.facultyId, value.optionId, value.studyLevelId]);

  const fieldClass = variant === "professor" ? "professor-field" : "field";
  const wrapperClass = variant === "professor" ? "professor-request-card" : "registration-request-card";
  const update = (patch) => { setError(""); onChange({ ...value, ...patch }); };

  return <section className={wrapperClass}>
    <div className="request-card-heading">
      <strong>{heading}</strong>
      {removable && <button type="button" className="request-remove-button" onClick={onRemove}>Retirer</button>}
    </div>
    <label className={fieldClass}><span>Université</span><select required value={value.universityId || ""} onChange={event => update({ universityId: event.target.value, facultyId: "", optionId: "", studyLevelId: "", courseId: "" })}><option value="">{loadingUniversities ? "Chargement des universités…" : "Choisir l’université"}</option>{universities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {!loadingUniversities && !error && universities.length===0 && <p className="request-catalog-error" role="status">Aucune université ne propose actuellement de cours actifs dans le catalogue. Les responsables de programme doivent d’abord créer et activer les cours.</p>}
    <label className={fieldClass}><span>Faculté / école</span><select required disabled={!value.universityId} value={value.facultyId || ""} onChange={event => update({ facultyId: event.target.value, optionId: "", studyLevelId: "", courseId: "" })}><option value="">Choisir la faculté</option>{faculties.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className={fieldClass}><span>Option / programme</span><select required disabled={!value.facultyId} value={value.optionId || ""} onChange={event => update({ optionId: event.target.value, studyLevelId: "", courseId: "" })}><option value="">Choisir le programme</option>{options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className={fieldClass}><span>Niveau</span><select required disabled={!value.optionId} value={value.studyLevelId || ""} onChange={event => update({ studyLevelId: event.target.value, courseId: "" })}><option value="">Choisir le niveau</option>{levels.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label className={fieldClass}><span>Cours demandé</span><select required disabled={!value.studyLevelId} value={value.courseId || ""} onChange={event => update({ courseId: event.target.value })}><option value="">{value.studyLevelId ? "Choisir un cours" : "Choisir d’abord un niveau"}</option>{courses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {error && <p className="request-catalog-error" role="status">{error}</p>}
  </section>;
}
