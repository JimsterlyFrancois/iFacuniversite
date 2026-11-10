import { useEffect, useState } from "react";

export default function AcademicCourseRequestFields({
  value,
  onChange,
  request,
  variant = "auth",
  heading = "Demande de cours",
  removable = false,
  onRemove
}) {
  const [universities, setUniversities] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [options, setOptions] = useState([]);
  const [levels, setLevels] = useState([]);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    request("/catalog/universities")
      .then(result => { if (!cancelled) setUniversities(result.data || []); })
      .catch(() => { if (!cancelled) setError("Impossible de charger le catalogue des universités."); });
    return () => { cancelled = true; };
  }, [request]);

  useEffect(() => {
    let cancelled = false;
    setFaculties([]); setOptions([]); setLevels([]); setCourses([]);
    if (!value.universityId) return undefined;
    request("/catalog/faculties?universityId=" + encodeURIComponent(value.universityId))
      .then(result => { if (!cancelled) setFaculties(result.data || []); })
      .catch(() => { if (!cancelled) setError("Impossible de charger les facultés de cette université."); });
    return () => { cancelled = true; };
  }, [request, value.universityId]);

  useEffect(() => {
    let cancelled = false;
    setOptions([]); setLevels([]); setCourses([]);
    if (!value.facultyId) return undefined;
    request("/catalog/options?facultyId=" + encodeURIComponent(value.facultyId))
      .then(result => { if (!cancelled) setOptions(result.data || []); })
      .catch(() => { if (!cancelled) setError("Impossible de charger les programmes de cette faculté."); });
    return () => { cancelled = true; };
  }, [request, value.facultyId]);

  useEffect(() => {
    let cancelled = false;
    setLevels([]); setCourses([]);
    if (!value.optionId) return undefined;
    request("/catalog/levels?optionId=" + encodeURIComponent(value.optionId))
      .then(result => { if (!cancelled) setLevels(result.data || []); })
      .catch(() => { if (!cancelled) setError("Impossible de charger les niveaux de ce programme."); });
    return () => { cancelled = true; };
  }, [request, value.optionId]);

  useEffect(() => {
    let cancelled = false;
    setCourses([]);
    if (!value.studyLevelId) return undefined;
    request("/catalog/courses?studyLevelId=" + encodeURIComponent(value.studyLevelId))
      .then(result => { if (!cancelled) setCourses(result.data || []); })
      .catch(() => { if (!cancelled) setError("Impossible de charger les cours de ce niveau."); });
    return () => { cancelled = true; };
  }, [request, value.studyLevelId]);

  const fieldClass = variant === "professor" ? "professor-field" : "field";
  const wrapperClass = variant === "professor" ? "professor-request-card" : "registration-request-card";
  const update = (patch) => { setError(""); onChange({ ...value, ...patch }); };

  return <section className={wrapperClass}>
    <div className="request-card-heading">
      <strong>{heading}</strong>
      {removable && <button type="button" className="request-remove-button" onClick={onRemove}>Retirer</button>}
    </div>
    <label className={fieldClass}><span>Université</span><select required value={value.universityId || ""} onChange={event => update({ universityId: event.target.value, facultyId: "", optionId: "", studyLevelId: "", courseId: "" })}><option value="">Choisir l’université</option>{universities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className={fieldClass}><span>Faculté / école</span><select required disabled={!value.universityId} value={value.facultyId || ""} onChange={event => update({ facultyId: event.target.value, optionId: "", studyLevelId: "", courseId: "" })}><option value="">Choisir la faculté</option>{faculties.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className={fieldClass}><span>Option / programme</span><select required disabled={!value.facultyId} value={value.optionId || ""} onChange={event => update({ optionId: event.target.value, studyLevelId: "", courseId: "" })}><option value="">Choisir le programme</option>{options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className={fieldClass}><span>Niveau</span><select required disabled={!value.optionId} value={value.studyLevelId || ""} onChange={event => update({ studyLevelId: event.target.value, courseId: "" })}><option value="">Choisir le niveau</option>{levels.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label className={fieldClass}><span>Cours demandé</span><select required disabled={!value.studyLevelId} value={value.courseId || ""} onChange={event => update({ courseId: event.target.value })}><option value="">{value.studyLevelId ? "Choisir un cours" : "Choisir d’abord un niveau"}</option>{courses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {error && <p className="request-catalog-error" role="status">{error}</p>}
  </section>;
}
