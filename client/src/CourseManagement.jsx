import { useEffect, useState } from "react";

export default function CourseManagement({ token, request }) {
  const [subjects, setSubjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function load() {
    setBusy(true);
    setFeedback("");
    try {
      const [s, c] = await Promise.all([request("/admin/subjects", { token }), request("/admin/courses", { token })]);
      setSubjects(s.data || []);
      setCourses(c.data || []);
    } catch (error) {
      setFeedback(error.message || "Impossible de charger les cours.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function createCourse(event) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    try {
      const result = await request("/admin/courses", { token, method: "POST", body: JSON.stringify({ subjectId: Number(subjectId), name, description }) });
      setFeedback("Cours créé : " + result.course.name);
      setSubjectId("");
      setName("");
      setDescription("");
      await load();
    } catch (error) {
      setFeedback(error.message || "Création du cours impossible.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="profile-page">
    <section className="student-card">
      <h2>Créer un cours</h2>
      <p>Chaque cours est rattaché à une matière, une option et un niveau précis.</p>
      <form className="auth-form" onSubmit={createCourse}>
        <label className="field"><span>Matière</span><select required value={subjectId} onChange={event => setSubjectId(event.target.value)}><option value="">Choisir une matière</option>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name} · {subject.option_name} · {subject.level_label}</option>)}</select></label>
        <label className="field"><span>Nom du cours</span><input required maxLength="180" value={name} onChange={event => setName(event.target.value)} placeholder="Ex. : Méthodes de recherche" /></label>
        <label className="field"><span>Description (facultative)</span><textarea maxLength="3000" rows="3" value={description} onChange={event => setDescription(event.target.value)} placeholder="Description du cours" /></label>
        <button className="submit-button" disabled={busy || !subjectId || !name.trim()}>Créer le cours</button>
      </form>
    </section>
    <section className="student-card student-data-list">
      <h2>Cours enregistrés</h2>
      {courses.length === 0 && !busy ? <p>Aucun cours créé pour le moment.</p> : courses.map(course => <article className="student-data-item" key={course.id}><strong>{course.name}</strong><p>{course.subject_name} · {course.option_name} · {course.level_label}</p>{course.description && <small>{course.description}</small>}</article>)}
    </section>
    {feedback && <p className="form-feedback" role="status">{feedback}</p>}
  </div>;
}
