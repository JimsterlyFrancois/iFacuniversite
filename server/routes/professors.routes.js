import express from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { hasActiveRole } from "../lib/roleAuthorization.js";
import { deriveProfessorRoleStatus } from "../lib/professorApplicationStatus.js";

export function createProfessorsRouter({ pool, requireAuth, requireAdmin }) {
  const router = express.Router();
  let schemaReady;
  async function ensureSchema() {
    if (!schemaReady) schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS professor_invites (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        email VARCHAR(254) NOT NULL UNIQUE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        created_by BIGINT REFERENCES users(id),
        user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
        activated_at TIMESTAMPTZ,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS professor_assignments (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        invite_id BIGINT NOT NULL REFERENCES professor_invites(id) ON DELETE CASCADE,
        university_id BIGINT NOT NULL REFERENCES universities(id),
        faculty_id BIGINT NOT NULL REFERENCES faculties(id),
        option_id BIGINT NOT NULL REFERENCES options(id),
        study_level_id BIGINT NOT NULL REFERENCES study_levels(id),
        requested_course_id BIGINT REFERENCES courses(id) ON DELETE SET NULL,
        course_id BIGINT REFERENCES courses(id) ON DELETE SET NULL,
        approval_status VARCHAR(16) NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending','approved','rejected')),
        reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMPTZ,
        review_note TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        assigned_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS professor_assignments_requested_course_uidx ON professor_assignments(invite_id,requested_course_id) WHERE requested_course_id IS NOT NULL AND approval_status IN ('pending','approved');
      CREATE INDEX IF NOT EXISTS professor_assignments_user_idx ON professor_assignments(invite_id);
    `).catch(error => { schemaReady = null; throw error; });
    await schemaReady;
  }
  async function validAssignment(client, a) {
    const ids = [a?.universityId,a?.facultyId,a?.optionId,a?.studyLevelId].map(Number);
    if (!ids.every(id => Number.isSafeInteger(id) && id > 0)) return false;
    const r = await client.query(`
      SELECT l.id FROM universities u
      JOIN faculties f ON f.university_id=u.id
      JOIN options o ON o.faculty_id=f.id
      JOIN study_levels l ON l.option_id=o.id
      WHERE u.id=$1 AND f.id=$2 AND o.id=$3 AND l.id=$4
        AND u.is_active AND f.is_active AND o.is_active AND l.is_active
    `, ids);
    return r.rowCount > 0;
  }
  router.post("/auth/professor/activate", async (req,res) => {
    if (!pool) return res.status(503).json({error:"service_unavailable"});
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body?.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== "string" || password.length < 10 || password.length > 128)
      return res.status(400).json({error:"invalid_activation",message:"Vérifiez l’adresse e-mail et utilisez un code secret d’au moins 10 caractères."});
    try {
      await ensureSchema();
      const invite = await pool.query("SELECT * FROM professor_invites WHERE email=$1 AND is_active=TRUE", [email]);
      if (!invite.rowCount) return res.status(404).json({error:"professor_not_invited",message:"Cette adresse n’a pas encore été déclarée par l’administration."});
      if (invite.rows[0].activated_at) return res.status(409).json({error:"professor_already_activated",message:"Ce compte professeur est déjà activé. Connectez-vous."});
      const assignments = await pool.query("SELECT * FROM professor_assignments WHERE invite_id=$1 ORDER BY id", [invite.rows[0].id]);
      if (!assignments.rowCount) return res.status(409).json({error:"professor_without_assignment",message:"L’administration doit d’abord vous affecter à un niveau."});
      const supabaseUrl=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
      const apiKey=process.env.SUPABASE_PUBLISHABLE_KEY||"";
      if (!supabaseUrl || !apiKey) return res.status(503).json({error:"auth_not_configured"});
      const verifyUrl=new URL("/verify-email",process.env.APP_BASE_URL||"http://localhost:3435");
      const auth=await fetch(`${supabaseUrl}/auth/v1/signup?redirect_to=${encodeURIComponent(verifyUrl.toString())}`,{
        method:"POST",headers:{apikey:apiKey,"Content-Type":"application/json"},
        body:JSON.stringify({email,password,data:{first_name:invite.rows[0].first_name,last_name:invite.rows[0].last_name,role:"professor"}})
      });
      const data=await auth.json().catch(()=>({}));
      if (!auth.ok) {
        const detail=String(data.code||data.error_code||data.msg||data.message||"");
        if (/already registered|already been registered|user already exists|email_exists/i.test(detail))
          return res.status(409).json({error:"professor_auth_exists",message:"Un compte d’authentification existe déjà pour cette adresse. Contactez l’administration."});
        if (auth.status===429) return res.status(429).json({error:"email_rate_limited",message:"Trop de demandes. Réessayez plus tard."});
        console.error("Activation professeur Supabase:",auth.status,detail);
        return res.status(503).json({error:"professor_activation_unavailable",message:"Le compte n’a pas pu être créé. Vérifiez le service e-mail."});
      }
      const authUserId = data.user?.id || (await pool.query("SELECT id FROM auth.users WHERE lower(email)=lower($1) LIMIT 1",[email])).rows[0]?.id;
      if (!authUserId) return res.status(503).json({error:"professor_auth_identity_unavailable",message:"L’identifiant du compte Supabase est indisponible. Contactez l’administration."});
      const a=assignments.rows[0];
      const hash=await bcrypt.hash(randomBytes(48).toString("hex"),12);
      const client=await pool.connect();
      try {
        await client.query("BEGIN");
        const created=await client.query(`
          INSERT INTO users(auth_user_id,university_id,faculty_id,option_id,study_level_id,first_name,last_name,email,password_hash,role)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'professor') RETURNING id
        `,[authUserId,a.university_id,a.faculty_id,a.option_id,a.study_level_id,invite.rows[0].first_name,invite.rows[0].last_name,email,hash]);
        await client.query("UPDATE professor_invites SET user_id=$1,activated_at=NOW() WHERE id=$2",[created.rows[0].id,invite.rows[0].id]);
        const courseAssignment=await client.query("SELECT 1 FROM professor_assignments WHERE invite_id=$1 AND is_active=TRUE AND approval_status='approved' AND course_id IS NOT NULL LIMIT 1",[invite.rows[0].id]);
        await client.query(
          "INSERT INTO role_assignments(user_id,role,status) VALUES($1,'professor',$2) ON CONFLICT DO NOTHING",
          [created.rows[0].id,courseAssignment.rowCount?"active":"pending"]
        );
        await client.query("COMMIT");
      } catch(error) {
        await client.query("ROLLBACK").catch(()=>{});
        throw error;
      } finally { client.release(); }
      return res.status(201).json({message:"Compte professeur créé. Confirmez l’adresse e-mail reçue avant de vous connecter."});
    } catch(error) {
      console.error("Activation professeur:",error?.message||error);
      return res.status(503).json({error:"professor_activation_unavailable",message:"L’activation est temporairement indisponible."});
    }
  });

  router.get("/admin/professors/catalog", requireAuth, requireAdmin, async (_req,res) => {
    try {
      await ensureSchema();
      const [universities,faculties,options,levels,courses]=await Promise.all([
        pool.query("SELECT id,name FROM universities WHERE is_active ORDER BY name"),
        pool.query("SELECT id,university_id,name FROM faculties WHERE is_active ORDER BY name"),
        pool.query("SELECT id,faculty_id,name FROM options WHERE is_active ORDER BY name"),
        pool.query("SELECT id,option_id,label FROM study_levels WHERE is_active ORDER BY sort_order"),
        pool.query(`SELECT c.id,c.name,s.option_id,s.study_level_id,f.id AS faculty_id,f.university_id
          FROM courses c JOIN subjects s ON s.id=c.subject_id
          JOIN options o ON o.id=s.option_id JOIN faculties f ON f.id=o.faculty_id
          WHERE c.is_active=TRUE AND s.is_active=TRUE ORDER BY c.name`)
      ]);
      return res.json({data:{universities:universities.rows,faculties:faculties.rows,options:options.rows,levels:levels.rows,courses:courses.rows}});
    } catch { return res.status(503).json({error:"professor_catalog_unavailable"}); }
  });
  router.get("/admin/professors", requireAuth, requireAdmin, async (_req,res) => {
    try {
      await ensureSchema();
      const r=await pool.query(`
        SELECT i.id,i.email,i.first_name,i.last_name,i.activated_at,i.is_active,i.created_at,
          COALESCE(json_agg(json_build_object('id',a.id,'university_id',a.university_id,'university_name',u.name,
            'faculty_id',a.faculty_id,'faculty_name',f.name,'option_id',a.option_id,'option_name',o.name,
            'study_level_id',a.study_level_id,'level_label',l.label,'course_id',a.course_id,'course_name',c.name,'is_active',a.is_active)) FILTER (WHERE a.id IS NOT NULL),'[]') AS assignments
        FROM professor_invites i
        LEFT JOIN professor_assignments a ON a.invite_id=i.id
        LEFT JOIN courses c ON c.id=a.course_id
        LEFT JOIN universities u ON u.id=a.university_id
        LEFT JOIN faculties f ON f.id=a.faculty_id
        LEFT JOIN options o ON o.id=a.option_id
        LEFT JOIN study_levels l ON l.id=a.study_level_id
        GROUP BY i.id ORDER BY i.created_at DESC
      `);
      return res.json({data:r.rows});
    } catch { return res.status(503).json({error:"professors_unavailable"}); }
  });
  router.post("/admin/professors", requireAuth, requireAdmin, async (req,res) => {
    const email=typeof req.body?.email==="string"?req.body.email.trim().toLowerCase():"";
    const firstName=typeof req.body?.firstName==="string"?req.body.firstName.trim():"";
    const lastName=typeof req.body?.lastName==="string"?req.body.lastName.trim():"";
    const a=req.body?.assignment;
    const courseId=Number(a?.courseId);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!firstName||firstName.length>100||!lastName||lastName.length>100)
      return res.status(400).json({error:"invalid_professor",message:"Renseignez le nom, le prénom et une adresse e-mail valide."});
    const client=await pool.connect();
    try {
      await ensureSchema(); await client.query("BEGIN");
      const existing=await client.query("SELECT id FROM users WHERE email=$1",[email]);
      if(existing.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"email_already_used",message:"Cette adresse est déjà associée à un compte iFac."});}
      if(!(await validAssignment(client,a))){await client.query("ROLLBACK");return res.status(400).json({error:"invalid_assignment",message:"Sélectionnez une affectation universitaire valide."});}
      if(!Number.isSafeInteger(courseId)||courseId<1){await client.query("ROLLBACK");return res.status(400).json({error:"course_required",message:"Choisissez le cours auquel le professeur sera affecté."});}
      const course=await client.query(
        `SELECT c.id FROM courses c JOIN subjects s ON s.id=c.subject_id
         JOIN options o ON o.id=s.option_id JOIN faculties f ON f.id=o.faculty_id
         WHERE c.id=$1 AND s.option_id=$2 AND s.study_level_id=$3
           AND f.university_id=$4 AND f.id=$5 AND c.is_active=TRUE AND s.is_active=TRUE`,
        [courseId,Number(a.optionId),Number(a.studyLevelId),Number(a.universityId),Number(a.facultyId)]
      );
      if(!course.rowCount){await client.query("ROLLBACK");return res.status(400).json({error:"course_outside_assignment_scope"});}
      const inv=await client.query("INSERT INTO professor_invites(email,first_name,last_name,created_by) VALUES($1,$2,$3,$4) RETURNING id",[email,firstName,lastName,req.user.id]);
      await client.query(
        "INSERT INTO professor_assignments(invite_id,university_id,faculty_id,option_id,study_level_id,course_id,assigned_by) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [inv.rows[0].id,Number(a.universityId),Number(a.facultyId),Number(a.optionId),Number(a.studyLevelId),courseId,req.user.id]
      );
      await client.query("COMMIT");
      return res.status(201).json({message:"Professeur déclaré. Il peut maintenant activer son compte avec cette adresse e-mail."});
    } catch(error){await client.query("ROLLBACK").catch(()=>{});if(error.code==="23505")return res.status(409).json({error:"professor_already_declared",message:"Cette adresse est déjà déclarée."});return res.status(503).json({error:"professor_create_failed"});}
    finally{client.release();}
  });
  router.post("/admin/professors/:id/assignments", requireAuth, requireAdmin, async(req,res)=>{
    const id=Number(req.params.id),a=req.body?.assignment;
    const courseId=Number(req.body?.courseId ?? a?.courseId);
    if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:"invalid_professor_id"});
    const client=await pool.connect();
    try{
      await ensureSchema();await client.query("BEGIN");
      const exists=await client.query("SELECT id FROM professor_invites WHERE id=$1 AND is_active=TRUE",[id]);
      if(!exists.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"professor_not_found"});}
      if(!(await validAssignment(client,a))){await client.query("ROLLBACK");return res.status(400).json({error:"invalid_assignment"});}
      let selectedCourseId=null;
      if(Number.isSafeInteger(courseId)&&courseId>0){
        const course=await client.query(
          `SELECT c.id FROM courses c JOIN subjects s ON s.id=c.subject_id
           JOIN options o ON o.id=s.option_id JOIN faculties f ON f.id=o.faculty_id
           WHERE c.id=$1 AND s.option_id=$2 AND s.study_level_id=$3
             AND f.university_id=$4 AND f.id=$5 AND c.is_active=TRUE AND s.is_active=TRUE`,
          [courseId,Number(a.optionId),Number(a.studyLevelId),Number(a.universityId),Number(a.facultyId)]
        );
        if(!course.rowCount){await client.query("ROLLBACK");return res.status(400).json({error:"course_outside_assignment_scope",message:"Le cours choisi ne correspond pas à l’affectation universitaire."});}
        selectedCourseId=course.rows[0].id;
      }
      await client.query(
        "INSERT INTO professor_assignments(invite_id,university_id,faculty_id,option_id,study_level_id,course_id,assigned_by) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [id,Number(a.universityId),Number(a.facultyId),Number(a.optionId),Number(a.studyLevelId),selectedCourseId,req.user.id]
      );
      if(selectedCourseId){
        await client.query(
          "UPDATE role_assignments SET status='active',updated_at=NOW() WHERE user_id=(SELECT user_id FROM professor_invites WHERE id=$1) AND role='professor' AND status='pending'",
          [id]
        );
      }
      await client.query("COMMIT");return res.status(201).json({message:selectedCourseId?"Cours attribué au professeur. Son droit de publication est activé.":"Affectation de niveau ajoutée. Attribuez aussi un cours pour autoriser la publication."});
    }catch(error){await client.query("ROLLBACK").catch(()=>{});if(error.code==="23505")return res.status(409).json({error:"assignment_exists",message:"Cette affectation existe déjà."});return res.status(503).json({error:"assignment_failed"});}
    finally{client.release();}
  });
  router.patch("/admin/professors/:id/assignments/:assignmentId", requireAuth, requireAdmin, async(req,res)=>{
    const professorId=Number(req.params.id),assignmentId=Number(req.params.assignmentId),active=req.body?.active;
    if(!Number.isSafeInteger(professorId)||professorId<1||!Number.isSafeInteger(assignmentId)||assignmentId<1||typeof active!=="boolean")
      return res.status(400).json({error:"invalid_assignment_status"});
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const updated=await client.query(
        "UPDATE professor_assignments SET is_active=$1 WHERE id=$2 AND invite_id=$3 AND ($1=FALSE OR approval_status<>'rejected') RETURNING id,is_active,course_id,approval_status",
        [active,assignmentId,professorId]
      );
      if(!updated.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"professor_assignment_not_found"});}
      const account=await client.query("SELECT user_id,is_active FROM professor_invites WHERE id=$1",[professorId]);
      if(account.rows[0]?.user_id){
        const totals=await client.query(
          "SELECT COUNT(*) FILTER (WHERE approval_status='approved' AND is_active=TRUE AND course_id IS NOT NULL)::int AS approved_count,COUNT(*) FILTER (WHERE approval_status='pending' AND is_active=TRUE)::int AS pending_count FROM professor_assignments WHERE invite_id=$1",
          [professorId]
        );
        const roleStatus=account.rows[0].is_active?deriveProfessorRoleStatus(totals.rows[0].approved_count,totals.rows[0].pending_count):"revoked";
        await client.query(
          "UPDATE role_assignments SET status=$1,revoked_at=NULL,updated_at=NOW() WHERE user_id=$2 AND role='professor'",
          [roleStatus,account.rows[0].user_id]
        );
      }
      await client.query("COMMIT");
      return res.json({assignment:updated.rows[0],message:active?"Affectation réactivée.":"Affectation retirée. Le compte et les autres cours restent inchangés."});
    }catch(error){
      await client.query("ROLLBACK").catch(()=>{});
      return res.status(503).json({error:"professor_assignment_status_failed"});
    }finally{client.release();}
  });

  router.patch("/admin/professors/:id/status", requireAuth, requireAdmin, async(req,res)=>{
    const id=Number(req.params.id),active=req.body?.active;
    if(!Number.isSafeInteger(id)||id<1||typeof active!=="boolean")return res.status(400).json({error:"invalid_status"});
    try{
      await ensureSchema();
      const r=await pool.query("UPDATE professor_invites SET is_active=$1 WHERE id=$2 RETURNING user_id",[active,id]);
      if(!r.rowCount)return res.status(404).json({error:"professor_not_found"});
      if(r.rows[0].user_id){
        await pool.query("UPDATE users SET is_active=$1,disabled_at=$2,updated_at=NOW() WHERE id=$3",[active,active?null:new Date(),r.rows[0].user_id]);
        if(!active){
          await pool.query("UPDATE role_assignments SET status='revoked',revoked_at=NOW(),updated_at=NOW() WHERE user_id=$1 AND role='professor' AND status<>'revoked'",[r.rows[0].user_id]);
        }else{
          await pool.query(
            "UPDATE role_assignments SET status=CASE WHEN EXISTS (SELECT 1 FROM professor_assignments pa WHERE pa.invite_id=$2 AND pa.is_active=TRUE AND pa.approval_status='approved' AND pa.course_id IS NOT NULL) THEN 'active' WHEN EXISTS (SELECT 1 FROM professor_assignments pa WHERE pa.invite_id=$2 AND pa.is_active=TRUE AND pa.approval_status='pending') THEN 'pending' ELSE 'revoked' END,revoked_at=CASE WHEN EXISTS (SELECT 1 FROM professor_assignments pa WHERE pa.invite_id=$2 AND pa.is_active=TRUE AND pa.approval_status IN ('approved','pending')) THEN NULL ELSE NOW() END,updated_at=NOW() WHERE user_id=$1 AND role='professor'",
            [r.rows[0].user_id,id]
          );
        }
      }
      return res.json({message:active?"Professeur réactivé.":"Accès professeur suspendu."});
    }catch{return res.status(503).json({error:"professor_status_failed"});}
  });
  router.get("/professor/applications", requireAuth, async(req,res)=>{
    if(!hasActiveRole(req,"professor"))return res.status(403).json({error:"professor_required"});
    try{
      await ensureSchema();
      const result=await pool.query(
        "SELECT pa.id AS assignment_id,pa.approval_status,pa.is_active,pa.reviewed_at,pa.review_note,pa.requested_course_id,requested_course.name AS requested_course_name,pa.course_id,assigned_course.name AS course_name,un.name AS university_name,f.name AS faculty_name,o.name AS option_name,l.label AS level_label FROM professor_invites i JOIN professor_assignments pa ON pa.invite_id=i.id JOIN universities un ON un.id=pa.university_id JOIN faculties f ON f.id=pa.faculty_id JOIN options o ON o.id=pa.option_id JOIN study_levels l ON l.id=pa.study_level_id LEFT JOIN courses requested_course ON requested_course.id=pa.requested_course_id LEFT JOIN courses assigned_course ON assigned_course.id=pa.course_id WHERE i.user_id=$1 AND i.is_active=TRUE ORDER BY pa.created_at DESC,pa.id DESC",
        [req.user.id]
      );
      return res.json({data:result.rows});
    }catch(error){return res.status(503).json({error:"professor_applications_unavailable"});}
  });

  router.post("/professor/applications", requireAuth, async(req,res)=>{
    if(!hasActiveRole(req,"professor"))return res.status(403).json({error:"professor_required"});
    const application={
      universityId:Number(req.body?.universityId),
      facultyId:Number(req.body?.facultyId),
      optionId:Number(req.body?.optionId),
      studyLevelId:Number(req.body?.studyLevelId),
      courseId:Number(req.body?.courseId)
    };
    if(!Object.values(application).every(id=>Number.isSafeInteger(id)&&id>0))
      return res.status(400).json({error:"invalid_professor_application",message:"Sélectionnez une université, une faculté, un programme, un niveau et un cours."});
    const client=await pool.connect();
    try{
      await ensureSchema();
      await client.query("BEGIN");
      const invite=await client.query("SELECT id FROM professor_invites WHERE user_id=$1 AND is_active=TRUE FOR UPDATE",[req.user.id]);
      if(!invite.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"professor_profile_not_found"});}
      const course=await client.query(
        "SELECT c.id FROM courses c JOIN subjects s ON s.id=c.subject_id JOIN options o ON o.id=s.option_id JOIN faculties f ON f.id=o.faculty_id JOIN universities u ON u.id=f.university_id JOIN study_levels l ON l.id=s.study_level_id WHERE c.id=$1 AND u.id=$2 AND f.id=$3 AND o.id=$4 AND l.id=$5 AND c.is_active=TRUE AND s.is_active=TRUE AND o.is_active=TRUE AND f.is_active=TRUE AND u.is_active=TRUE AND l.is_active=TRUE",
        [application.courseId,application.universityId,application.facultyId,application.optionId,application.studyLevelId]
      );
      if(!course.rowCount){await client.query("ROLLBACK");return res.status(400).json({error:"course_outside_application_scope",message:"Ce cours ne correspond pas au périmètre universitaire choisi."});}
      const duplicate=await client.query(
        "SELECT id FROM professor_assignments WHERE invite_id=$1 AND ((requested_course_id=$2 AND approval_status IN ('pending','approved')) OR (course_id=$2 AND approval_status='approved' AND is_active=TRUE)) LIMIT 1",
        [invite.rows[0].id,application.courseId]
      );
      if(duplicate.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"course_request_exists",message:"Vous avez déjà demandé ce cours ou il vous a déjà été attribué."});}
      const inserted=await client.query(
        "INSERT INTO professor_assignments(invite_id,university_id,faculty_id,option_id,study_level_id,requested_course_id,course_id,approval_status,is_active) VALUES($1,$2,$3,$4,$5,$6,NULL,'pending',TRUE) RETURNING id",
        [invite.rows[0].id,application.universityId,application.facultyId,application.optionId,application.studyLevelId,application.courseId]
      );
      await client.query("INSERT INTO role_assignments(user_id,role,status) VALUES($1,'professor','pending') ON CONFLICT DO NOTHING",[req.user.id]);
      await client.query("UPDATE role_assignments SET status=CASE WHEN EXISTS (SELECT 1 FROM professor_assignments WHERE invite_id=$1 AND approval_status='approved' AND is_active=TRUE AND course_id IS NOT NULL) THEN 'active' ELSE 'pending' END,revoked_at=NULL,updated_at=NOW() WHERE user_id=$2 AND role='professor'",[invite.rows[0].id,req.user.id]);
      await client.query(
        "INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,university_id,faculty_id,option_id,study_level_id,metadata) VALUES($1,'professor.application.submitted','professor_assignment',$2,$3,$4,$5,$6,$7::jsonb)",
        [req.user.id,inserted.rows[0].id,application.universityId,application.facultyId,application.optionId,application.studyLevelId,JSON.stringify({courseId:application.courseId})]
      );
      await client.query("COMMIT");
      return res.status(201).json({message:"Demande de cours envoyée au responsable du programme concerné.",applicationId:inserted.rows[0].id});
    }catch(error){
      await client.query("ROLLBACK").catch(()=>{});
      if(error?.code==="23505")return res.status(409).json({error:"course_request_exists",message:"Ce cours fait déjà l’objet d’une demande ou d’une affectation."});
      return res.status(503).json({error:"professor_application_create_failed"});
    }finally{client.release();}
  });

  router.get("/professor/assignments", requireAuth, async(req,res)=>{
    if(!hasActiveRole(req,"professor"))return res.status(403).json({error:"professor_required"});
    try{
      await ensureSchema();
      const r=await pool.query(`
        SELECT u.name AS university_name,f.name AS faculty_name,o.name AS option_name,l.label AS level_label,c.id AS course_id,c.name AS course_name
        FROM professor_invites i JOIN role_assignments ra ON ra.user_id=i.user_id AND ra.role='professor' AND ra.status='active'
        JOIN professor_assignments a ON a.invite_id=i.id
        JOIN universities u ON u.id=a.university_id JOIN faculties f ON f.id=a.faculty_id
        JOIN options o ON o.id=a.option_id JOIN study_levels l ON l.id=a.study_level_id
        LEFT JOIN courses c ON c.id=a.course_id
        WHERE i.user_id=$1 AND i.is_active=TRUE AND a.is_active=TRUE AND a.approval_status='approved' AND a.course_id IS NOT NULL ORDER BY u.name,f.name,o.name,l.sort_order
      `,[req.user.id]);
      return res.json({data:r.rows});
    }catch{return res.status(503).json({error:"professor_assignments_unavailable"});}
  });
  return router;
}
