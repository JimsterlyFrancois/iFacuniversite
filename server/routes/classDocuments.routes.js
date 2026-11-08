import express from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";

const CLASS_BUCKET = "class-documents";
let delegateMessagesTableReady;
async function ensureDelegateMessagesTable(pool) {
  if (!delegateMessagesTableReady) delegateMessagesTableReady = pool.query(`CREATE TABLE IF NOT EXISTS delegate_messages (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, university_id BIGINT NOT NULL REFERENCES universities(id), faculty_id BIGINT NOT NULL REFERENCES faculties(id), option_id BIGINT NOT NULL REFERENCES options(id), study_level_id BIGINT NOT NULL REFERENCES study_levels(id), subject VARCHAR(220) NOT NULL, body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), read_at TIMESTAMPTZ)`).catch(error => { delegateMessagesTableReady = null; throw error; });
  await delegateMessagesTableReady;
}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, file.mimetype === "application/pdf")
});
const positiveId = value => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export function createClassDocumentsRouter({ pool, requireAuth, requireAdmin, storePrivateObject, readPrivateObject, deletePrivateObject }) {
  const router = express.Router();

  router.get("/admin/classes", requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT u.id AS university_id,u.name AS university_name,f.id AS faculty_id,f.name AS faculty_name,o.id AS option_id,o.name AS option_name,l.id AS study_level_id,l.label AS study_level_label,COUNT(st.id) FILTER (WHERE st.is_active=TRUE AND st.role IN ('student','delegate'))::int AS student_count,COUNT(st.id) FILTER (WHERE st.is_active=TRUE AND st.role='delegate')::int AS delegate_count\n" +
        "FROM universities u JOIN faculties f ON f.university_id=u.id AND f.is_active=TRUE JOIN options o ON o.faculty_id=f.id AND o.is_active=TRUE JOIN study_levels l ON l.option_id=o.id AND l.is_active=TRUE\n" +
        "LEFT JOIN users st ON st.university_id=u.id AND st.faculty_id=f.id AND st.option_id=o.id AND st.study_level_id=l.id\n" +
        "WHERE u.id=$1 AND u.is_active=TRUE GROUP BY u.id,u.name,f.id,f.name,o.id,o.name,l.id,l.label,l.sort_order ORDER BY f.name,o.name,l.sort_order",
        [req.user.university_id]
      );
      return res.json({ data: result.rows });
    } catch (error) {
      console.error("Liste des classes indisponible:", error?.message);
      return res.status(503).json({ error: "classes_unavailable" });
    }
  });

  router.get("/admin/classes/:universityId/:facultyId/:optionId/:studyLevelId/students", requireAuth, requireAdmin, async (req, res) => {
    const ids = ["universityId","facultyId","optionId","studyLevelId"].map(key => positiveId(req.params[key]));
    if (ids.some(id => !id) || ids[0] !== Number(req.user.university_id)) return res.status(400).json({ error: "invalid_class_scope" });
    try {
      const result = await pool.query(
        "SELECT id,first_name,last_name,email,role,created_at FROM users WHERE university_id=$1 AND faculty_id=$2 AND option_id=$3 AND study_level_id=$4 AND is_active=TRUE AND role IN ('student','delegate') ORDER BY role DESC,last_name,first_name",
        ids
      );
      return res.json({ data: result.rows });
    } catch (error) {
      console.error("Liste des étudiants indisponible:", error?.message);
      return res.status(503).json({ error: "class_students_unavailable" });
    }
  });

  router.post("/admin/classes/:universityId/:facultyId/:optionId/:studyLevelId/delegates", requireAuth, requireAdmin, async (req, res) => {
    const ids = ["universityId","facultyId","optionId","studyLevelId"].map(key => positiveId(req.params[key]));
    const userId = positiveId(req.body?.userId);
    if (ids.some(id => !id) || ids[0] !== Number(req.user.university_id) || !userId) return res.status(400).json({ error: "invalid_delegate_assignment" });
    try {
      const result = await pool.query(
        "UPDATE users SET role='delegate',updated_at=NOW() WHERE id=$1 AND university_id=$2 AND faculty_id=$3 AND option_id=$4 AND study_level_id=$5 AND is_active=TRUE AND role IN ('student','delegate') RETURNING id,first_name,last_name,email,role",
        [userId, ...ids]
      );
      if (!result.rowCount) return res.status(404).json({ error: "student_not_found_in_class" });
      return res.json({ delegate: result.rows[0] });
    } catch (error) {
      if (error?.code === "P0001") return res.status(409).json({ error: "delegate_limit_reached", message: "Cette classe possède déjà trois délégués." });
      console.error("Désignation du délégué échouée:", error?.message);
      return res.status(503).json({ error: "delegate_assignment_failed" });
    }
  });

  router.delete("/admin/classes/:universityId/:facultyId/:optionId/:studyLevelId/delegates/:userId", requireAuth, requireAdmin, async (req, res) => {
    const ids = ["universityId","facultyId","optionId","studyLevelId"].map(key => positiveId(req.params[key]));
    const userId = positiveId(req.params.userId);
    if (ids.some(id => !id) || ids[0] !== Number(req.user.university_id) || !userId) return res.status(400).json({ error: "invalid_delegate_removal" });
    try {
      const result = await pool.query(
        "UPDATE users SET role='student',updated_at=NOW() WHERE id=$1 AND university_id=$2 AND faculty_id=$3 AND option_id=$4 AND study_level_id=$5 AND role='delegate' RETURNING id,first_name,last_name,email,role",
        [userId, ...ids]
      );
      return result.rowCount ? res.json({ student: result.rows[0] }) : res.status(404).json({ error: "delegate_not_found_in_class" });
    } catch (error) {
      console.error("Retrait du délégué échoué:", error?.message);
      return res.status(503).json({ error: "delegate_removal_failed" });
    }
  });

  router.post("/class-documents", requireAuth, upload.single("file"), async (req, res) => {
    const { title, course, professor = "", description = "" } = req.body || {};
    if (!req.file || req.file.mimetype !== "application/pdf" || req.file.buffer.subarray(0, 5).toString() !== "%PDF-") {
      return res.status(400).json({ error: "pdf_file_required", message: "Joignez un véritable fichier PDF de 25 Mo maximum." });
    }
    if (typeof title !== "string" || !title.trim() || title.trim().length > 220 ||
        typeof course !== "string" || !course.trim() || course.trim().length > 180 ||
        typeof professor !== "string" || professor.trim().length > 180 ||
        typeof description !== "string" || description.trim().length > 3000) {
      return res.status(400).json({ error: "invalid_document_metadata" });
    }

    let universityId=positiveId(req.user.university_id);
    let facultyId=positiveId(req.user.faculty_id);
    let optionId=positiveId(req.user.option_id);
    let studyLevelId=positiveId(req.user.study_level_id);
    let publisherRole=null;
    let courseId=null;
    let subjectId=null;
    let courseLabel=course.trim();

    try {
      if (req.user.role === "professor") {
        const requestedCourseId=positiveId(req.body?.courseId);
        if(!requestedCourseId)return res.status(400).json({error:"course_id_required"});
        const assignedCourse = await pool.query(
          `SELECT c.id AS course_id,c.name AS course_name,s.id AS subject_id,
             pa.university_id,pa.faculty_id,pa.option_id,pa.study_level_id
           FROM professor_invites i
           JOIN professor_assignments pa ON pa.invite_id=i.id AND pa.is_active=TRUE
           JOIN courses c ON c.id=pa.course_id AND c.is_active=TRUE
           JOIN subjects s ON s.id=c.subject_id AND s.is_active=TRUE
           WHERE i.user_id=$1 AND i.is_active=TRUE
             AND pa.university_id IS NOT NULL AND c.id=$2
           LIMIT 1`,
          [req.user.id,requestedCourseId]
        );
        if (!assignedCourse.rowCount) {
          return res.status(403).json({ error: "course_assignment_required", message: "Vous ne pouvez publier que dans un cours qui vous a été attribué." });
        }
        const assigned=assignedCourse.rows[0];
        universityId=Number(assigned.university_id);
        facultyId=Number(assigned.faculty_id);
        optionId=Number(assigned.option_id);
        studyLevelId=Number(assigned.study_level_id);
        courseId=assigned.course_id;
        courseLabel=assigned.course_name;
        subjectId=assigned.subject_id;
        publisherRole="professor";
      } else {
        if (![universityId,facultyId,optionId,studyLevelId].every(Boolean)) {
          return res.status(400).json({ error: "incomplete_academic_profile" });
        }
        if (req.user.role === "delegate") {
          publisherRole = "delegate";
        } else {
          const assignment = await pool.query(
            `SELECT role FROM role_assignments
             WHERE user_id=$1 AND status='active'
               AND (
                 role='admin_general'
                 OR (role='university_admin' AND university_id=$2)
                 OR (role='faculty_manager' AND university_id=$2 AND faculty_id=$3)
                 OR (role='program_manager' AND university_id=$2 AND faculty_id=$3
                     AND option_id=$4 AND (study_level_id IS NULL OR study_level_id=$5))
               )
             ORDER BY CASE role
               WHEN 'admin_general' THEN 1 WHEN 'university_admin' THEN 2
               WHEN 'faculty_manager' THEN 3 ELSE 4 END
             LIMIT 1`,
            [req.user.id,universityId,facultyId,optionId,studyLevelId]
          );
          if (!assignment.rowCount) return res.status(403).json({ error: "publication_not_authorized", message: "Votre compte ne possède pas de droit de publication dans ce parcours." });
          publisherRole=assignment.rows[0].role;
        }
      }

      if (!subjectId) {
        const subject = await pool.query(
          "SELECT id FROM subjects WHERE option_id=$1 AND study_level_id=$2 AND is_active=TRUE AND lower(name)=lower($3) LIMIT 1",
          [optionId, studyLevelId, course.trim()]
        );
        subjectId = subject.rows[0]?.id || null;
      }
      if (!subjectId) {
        return res.status(400).json({ error: "subject_not_found", message: "La matière doit exister dans le programme avant la publication." });
      }

      const fileKey = universityId + "/" + facultyId + "/" + optionId + "/" + studyLevelId + "/" + randomUUID() + ".pdf";
      await storePrivateObject(fileKey, req.file.buffer, "application/pdf", CLASS_BUCKET);
      try {
        const authorName = [req.user.first_name, req.user.last_name].filter(Boolean).join(" ");
        const result = await pool.query(
          "INSERT INTO documents (subject_id,title,file_key,mime_type,file_size_bytes,uploaded_by,is_active,university_id,faculty_id,option_id,study_level_id,course,professor,description,file_name,status,course_id,publication_scope,published_by_role,storage_bucket) " +
          "VALUES ($1,$2,$3,'application/pdf',$4,$5,TRUE,$6,$7,$8,$9,$10,$11,$12,$13,'approved',$14,$15,$16,'class-documents') " +
          "RETURNING id,title,course,professor,description,file_name,status,publication_scope,created_at",
          [subjectId,title.trim(),fileKey,req.file.size,req.user.id,universityId,facultyId,optionId,studyLevelId,courseLabel,professor.trim() || (publisherRole === "professor" ? authorName : null),description.trim() || null,req.file.originalname.slice(0,255),courseId,courseId ? "course" : "class",publisherRole]
        );
        const notified = await pool.query(
          "INSERT INTO notifications (user_id,document_id) SELECT u.id,$1 FROM users u WHERE u.is_active=TRUE AND u.university_id=$2 AND u.faculty_id=$3 AND u.option_id=$4 AND u.study_level_id=$5 AND u.id<>$6 AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id=u.id AND n.document_id=$1)",
          [result.rows[0].id,universityId,facultyId,optionId,studyLevelId,req.user.id]
        );
        await pool.query(
          "INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,university_id,faculty_id,option_id,study_level_id,metadata) VALUES($1,'document.published','document',$2,$3,$4,$5,$6,$7::jsonb)",
          [req.user.id,result.rows[0].id,universityId,facultyId,optionId,studyLevelId,JSON.stringify({ publisherRole, publicationScope: courseId ? "course" : "class" })]
        );
        return res.status(201).json({ document: result.rows[0], notificationsCreated: notified.rowCount, message: "Document publié dans le périmètre autorisé." });
      } catch (error) {
        await deletePrivateObject(fileKey, CLASS_BUCKET).catch(() => {});
        throw error;
      }
    } catch (error) {
      console.error("Dépôt de document de classe échoué:", error?.message);
      return res.status(503).json({ error: "class_document_upload_failed" });
    }
  });

  router.get("/class-documents", requireAuth, async (req, res) => {
    try {
      let result;
      if (req.user.role === "professor") {
        result = await pool.query(
          `SELECT DISTINCT d.id,d.title,d.course,d.professor,d.description,d.file_name,d.mime_type,d.file_size_bytes,d.created_at
           FROM documents d
           JOIN professor_invites i ON i.user_id=$1 AND i.is_active=TRUE
           JOIN professor_assignments pa ON pa.invite_id=i.id AND pa.is_active=TRUE AND pa.course_id=d.course_id
           WHERE d.status='approved' AND d.is_active=TRUE AND d.storage_bucket='class-documents' AND d.course_id IS NOT NULL
           ORDER BY d.created_at DESC LIMIT 300`,
          [req.user.id]
        );
      } else {
        result = await pool.query(
          "SELECT id,title,course,professor,description,file_name,mime_type,file_size_bytes,created_at FROM documents WHERE university_id=$1 AND faculty_id=$2 AND option_id=$3 AND study_level_id=$4 AND status='approved' AND is_active=TRUE AND storage_bucket='class-documents' ORDER BY created_at DESC LIMIT 300",
          [req.user.university_id,req.user.faculty_id,req.user.option_id,req.user.study_level_id]
        );
      }
      return res.json({ data: result.rows });
    } catch (error) {
      console.error("Documents de classe indisponibles:", error?.message);
      return res.status(503).json({ error: "class_documents_unavailable" });
    }
  });

  router.get("/admin/class-documents", requireAuth, requireAdmin, async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "pending";
    if (!["pending","approved","rejected","all"].includes(status)) return res.status(400).json({ error: "invalid_document_status" });
    try {
      const result = await pool.query(
        "SELECT d.id,d.title,d.course,d.professor,d.description,d.file_name,d.status,d.rejection_reason,d.created_at,d.file_size_bytes,u.first_name AS uploader_first_name,u.last_name AS uploader_last_name,f.name AS faculty_name,o.name AS option_name,l.label AS study_level_label " +
        "FROM documents d LEFT JOIN users u ON u.id=d.uploaded_by LEFT JOIN faculties f ON f.id=d.faculty_id LEFT JOIN options o ON o.id=d.option_id LEFT JOIN study_levels l ON l.id=d.study_level_id " +
        "WHERE d.university_id=$1 AND d.is_active=TRUE AND d.storage_bucket='class-documents' AND ($2='all' OR d.status=$2) ORDER BY CASE d.status WHEN 'pending' THEN 0 ELSE 1 END,d.created_at DESC LIMIT 500",
        [req.user.university_id,status]
      );
      return res.json({ data: result.rows });
    } catch (error) {
      console.error("File de validation indisponible:", error?.message);
      return res.status(503).json({ error: "document_review_queue_unavailable" });
    }
  });

  router.patch("/admin/class-documents/:id", requireAuth, requireAdmin, async (req,res) => {
    const id=positiveId(req.params.id), title=typeof req.body?.title==="string"?req.body.title.trim():"", course=typeof req.body?.course==="string"?req.body.course.trim():"", professor=typeof req.body?.professor==="string"?req.body.professor.trim():"", description=typeof req.body?.description==="string"?req.body.description.trim():"";
    if(!id||!title||title.length>220||!course||course.length>180||professor.length>180||description.length>3000) return res.status(400).json({error:"invalid_class_document_update"});
    try {
      const result=await pool.query("UPDATE documents SET title=$1,course=$2,professor=$3,description=$4,updated_at=NOW() WHERE id=$5 AND university_id=$6 AND is_active=TRUE RETURNING id,title,course,professor,description,status", [title,course,professor||null,description||null,id,req.user.university_id]);
      return result.rowCount?res.json({document:result.rows[0]}):res.status(404).json({error:"class_document_not_found"});
    } catch { return res.status(503).json({error:"class_document_update_failed"}); }
  });
  router.delete("/admin/class-documents/:id", requireAuth, requireAdmin, async (req,res) => {
    const id=positiveId(req.params.id); if(!id) return res.status(400).json({error:"invalid_document_id"});
    try {
      const found=await pool.query("UPDATE documents SET is_active=FALSE,updated_at=NOW() WHERE id=$1 AND university_id=$2 AND is_active=TRUE AND storage_bucket='class-documents' RETURNING file_key", [id,req.user.university_id]);
      if(!found.rowCount) return res.status(404).json({error:"class_document_not_found"});
      await deletePrivateObject(found.rows[0].file_key,CLASS_BUCKET).catch(error=>console.error("Suppression PDF classe:",error?.message));
      return res.status(204).end();
    } catch { return res.status(503).json({error:"class_document_delete_failed"}); }
  });
  router.post("/admin/class-documents/:id/review", requireAuth, requireAdmin, async (req, res) => {
    const documentId = positiveId(req.params.id);
    const status = req.body?.status;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!documentId || !["approved","rejected"].includes(status) || (status === "rejected" && !reason) || reason.length > 1500) return res.status(400).json({ error: "invalid_review_decision" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query("SELECT * FROM documents WHERE id=$1 AND university_id=$2 AND is_active=TRUE FOR UPDATE", [documentId,req.user.university_id]);
      if (!found.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "class_document_not_found" });
      }
      const document = found.rows[0];
      if (document.status !== "pending") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "document_already_reviewed" });
      }
      const updated = await client.query(
        "UPDATE documents SET status=$1,rejection_reason=$2,reviewed_by=$3,reviewed_at=NOW(),updated_at=NOW() WHERE id=$4 RETURNING id,title,course,status,rejection_reason,reviewed_at",
        [status,status === "rejected" ? reason : null,req.user.id,documentId]
      );
      let notificationsCreated = 0;
      if (status === "approved") {
        const notified = await client.query(
          "INSERT INTO notifications (user_id,document_id) SELECT u.id,$1 FROM users u WHERE u.is_active=TRUE AND u.university_id=$2 AND u.faculty_id=$3 AND u.option_id=$4 AND u.study_level_id=$5 AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id=u.id AND n.document_id=$1)",
          [documentId,document.university_id,document.faculty_id,document.option_id,document.study_level_id]
        );
        notificationsCreated = notified.rowCount;
      }
      await client.query("COMMIT");
      return res.json({ document: updated.rows[0], notificationsCreated });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Validation du document échouée:", error?.message);
      return res.status(503).json({ error: "document_review_failed" });
    } finally {
      client.release();
    }
  });

  router.get("/class-documents/:id/download", requireAuth, async (req, res) => {
    const documentId = positiveId(req.params.id);
    if (!documentId) return res.status(400).json({ error: "invalid_document_id" });
    const isAdmin = req.user.role === "admin";
    const isProfessor = req.user.role === "professor";
    try {
      const result = await pool.query(
        `SELECT d.id,d.file_key,d.file_name,d.mime_type
         FROM documents d
         WHERE d.id=$1 AND d.is_active=TRUE AND d.storage_bucket='class-documents' AND (
           (d.status='approved' AND d.university_id=$2 AND d.faculty_id=$3 AND d.option_id=$4 AND d.study_level_id=$5)
           OR ($6=TRUE AND d.university_id=$7)
           OR ($8=TRUE AND d.course_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM professor_invites i
             JOIN professor_assignments pa ON pa.invite_id=i.id AND pa.is_active=TRUE
             WHERE i.user_id=$9 AND i.is_active=TRUE AND pa.course_id=d.course_id
           ))
         )`,
        [documentId,req.user.university_id,req.user.faculty_id,req.user.option_id,req.user.study_level_id,isAdmin,req.user.university_id,isProfessor,req.user.id]
      );
      if (!result.rowCount) return res.status(404).json({ error: "document_not_found" });
      const row = result.rows[0];
      const file = await readPrivateObject(row.file_key, CLASS_BUCKET);
      const safeName = (row.file_name || ("ifac-document-" + row.id + ".pdf")).replace(/[\r\n"]/g,"_");
      res.set("Content-Type",row.mime_type || "application/pdf");
      res.set("Content-Length",String(file.length));
      res.set("Content-Disposition","attachment; filename=\"ifac-document-" + row.id + ".pdf\"; filename*=UTF-8''" + encodeURIComponent(safeName));
      res.set("X-Content-Type-Options","nosniff");
      res.set("Cache-Control","private, no-store");
      return res.send(file);
    } catch (error) {
      console.error("Téléchargement document de classe échoué:", error?.message);
      return res.status(503).json({ error: "class_document_download_failed" });
    }
  });


  router.post("/delegate/messages", requireAuth, async (req, res) => {
    if (req.user.role !== "delegate") return res.status(403).json({ error: "delegate_required" });
    const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!subject || subject.length > 220 || !body || body.length > 5000) return res.status(400).json({ error: "invalid_delegate_message" });
    try {
      await ensureDelegateMessagesTable(pool);
      const result = await pool.query(
        "INSERT INTO delegate_messages(sender_id,university_id,faculty_id,option_id,study_level_id,subject,body) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,subject,body,created_at",
        [req.user.id,req.user.university_id,req.user.faculty_id,req.user.option_id,req.user.study_level_id,subject,body]
      );
      return res.status(201).json({ message: result.rows[0], notice: "Message transmis à l’administration iFac." });
    } catch (error) {
      console.error("Message délégué indisponible:", error?.message);
      return res.status(503).json({ error: "delegate_message_send_failed" });
    }
  });

  router.get("/admin/delegate-messages", requireAuth, requireAdmin, async (req, res) => {
    try {
      await ensureDelegateMessagesTable(pool);
      const result = await pool.query(
        "SELECT dm.id,dm.subject,dm.body,dm.created_at,dm.read_at,u.id AS sender_id,u.first_name,u.last_name,u.email,f.name AS faculty_name,o.name AS option_name,l.label AS study_level_label FROM delegate_messages dm JOIN users u ON u.id=dm.sender_id LEFT JOIN faculties f ON f.id=dm.faculty_id LEFT JOIN options o ON o.id=dm.option_id LEFT JOIN study_levels l ON l.id=dm.study_level_id WHERE dm.university_id=$1 ORDER BY dm.created_at DESC LIMIT 300",
        [req.user.university_id]
      );
      return res.json({ data: result.rows, unreadCount: result.rows.filter(row => !row.read_at).length });
    } catch (error) {
      console.error("Boîte des délégués indisponible:", error?.message);
      return res.status(503).json({ error: "delegate_messages_unavailable" });
    }
  });

  router.patch("/admin/delegate-messages/:id", requireAuth, requireAdmin, async (req,res) => {
    const id=positiveId(req.params.id), subject=typeof req.body?.subject==="string"?req.body.subject.trim():"", body=typeof req.body?.body==="string"?req.body.body.trim():"";
    if(!id||!subject||subject.length>220||!body||body.length>5000) return res.status(400).json({error:"invalid_delegate_message"});
    try {
      await ensureDelegateMessagesTable(pool);
      const result=await pool.query("UPDATE delegate_messages SET subject=$1,body=$2 WHERE id=$3 AND university_id=$4 RETURNING id,subject,body", [subject,body,id,req.user.university_id]);
      return result.rowCount?res.json({message:result.rows[0]}):res.status(404).json({error:"delegate_message_not_found"});
    } catch { return res.status(503).json({error:"delegate_message_update_failed"}); }
  });
  router.delete("/admin/delegate-messages/:id", requireAuth, requireAdmin, async (req,res) => {
    const id=positiveId(req.params.id); if(!id) return res.status(400).json({error:"invalid_message_id"});
    try {
      await ensureDelegateMessagesTable(pool);
      const result=await pool.query("DELETE FROM delegate_messages WHERE id=$1 AND university_id=$2 RETURNING id", [id,req.user.university_id]);
      return result.rowCount?res.status(204).end():res.status(404).json({error:"delegate_message_not_found"});
    } catch { return res.status(503).json({error:"delegate_message_delete_failed"}); }
  });
  router.patch("/admin/delegate-messages/:id/read", requireAuth, requireAdmin, async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid_message_id" });
    try {
      await ensureDelegateMessagesTable(pool);
      const result = await pool.query("UPDATE delegate_messages SET read_at=COALESCE(read_at,NOW()) WHERE id=$1 AND university_id=$2 RETURNING id,read_at", [id,req.user.university_id]);
      return result.rowCount ? res.json({ message: result.rows[0] }) : res.status(404).json({ error: "delegate_message_not_found" });
    } catch {
      return res.status(503).json({ error: "delegate_message_update_failed" });
    }
  });

  router.get("/notifications", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT n.id,n.document_id,n.created_at,n.read_at,d.title,d.course,d.status FROM notifications n JOIN documents d ON d.id=n.document_id WHERE n.user_id=$1 ORDER BY n.created_at DESC LIMIT 100",
        [req.user.id]
      );
      return res.json({ data: result.rows, unreadCount: result.rows.filter(item => !item.read_at).length });
    } catch (error) {
      console.error("Notifications indisponibles:", error?.message);
      return res.status(503).json({ error: "notifications_unavailable" });
    }
  });

  router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
    const notificationId = positiveId(req.params.id);
    if (!notificationId) return res.status(400).json({ error: "invalid_notification_id" });
    try {
      const result = await pool.query("UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=$1 AND user_id=$2 RETURNING id,read_at", [notificationId,req.user.id]);
      return result.rowCount ? res.json({ notification: result.rows[0] }) : res.status(404).json({ error: "notification_not_found" });
    } catch (error) {
      console.error("Marquage notification échoué:", error?.message);
      return res.status(503).json({ error: "notification_update_failed" });
    }
  });

  router.post("/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const result = await pool.query("UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL", [req.user.id]);
      return res.json({ updated: result.rowCount });
    } catch (error) {
      console.error("Marquage des notifications échoué:", error?.message);
      return res.status(503).json({ error: "notifications_update_failed" });
    }
  });

  return router;
}
