import express from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

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
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(invite_id, study_level_id)
      );
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
      const a=assignments.rows[0];
      const hash=await bcrypt.hash(randomBytes(48).toString("hex"),12);
      const client=await pool.connect();
      try {
        await client.query("BEGIN");
        const created=await client.query(`
          INSERT INTO users(university_id,faculty_id,option_id,study_level_id,first_name,last_name,email,password_hash,role)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,'professor') RETURNING id
        `,[a.university_id,a.faculty_id,a.option_id,a.study_level_id,invite.rows[0].first_name,invite.rows[0].last_name,email,hash]);
        await client.query("UPDATE professor_invites SET user_id=$1,activated_at=NOW() WHERE id=$2",[created.rows[0].id,invite.rows[0].id]);
        const courseAssignment=await client.query("SELECT 1 FROM professor_assignments WHERE invite_id=$1 AND is_active=TRUE AND course_id IS NOT NULL LIMIT 1",[invite.rows[0].id]);
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

  router.post("/auth/professor/register", async (req,res) => {
    if (!pool) return res.status(503).json({error:"service_unavailable"});
    const email=typeof req.body?.email==="string"?req.body.email.trim().toLowerCase():"";
    const firstName=typeof req.body?.firstName==="string"?req.body.firstName.trim():"";
    const lastName=typeof req.body?.lastName==="string"?req.body.lastName.trim():"";
    const password=req.body?.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||
        !firstName||firstName.length>100||!lastName||lastName.length>100||
        typeof password!=="string"||password.length<10||password.length>128) {
      return res.status(400).json({error:"invalid_professor_registration",message:"Renseignez votre nom, votre prénom, une adresse e-mail valide et un mot de passe de 10 caractères minimum."});
    }
    try {
      await ensureSchema();
      const existing=await pool.query("SELECT id FROM users WHERE email=$1",[email]);
      if(existing.rowCount) return res.status(409).json({error:"email_already_registered",message:"Cette adresse e-mail possède déjà un compte iFac."});
      const supabaseUrl=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
      const apiKey=process.env.SUPABASE_PUBLISHABLE_KEY||"";
      if(!supabaseUrl||!apiKey) return res.status(503).json({error:"auth_not_configured"});
      const verifyUrl=new URL("/verify-email",process.env.APP_BASE_URL||"http://localhost:3435");
      const auth=await fetch(`${supabaseUrl}/auth/v1/signup?redirect_to=${encodeURIComponent(verifyUrl.toString())}`,{
        method:"POST",headers:{apikey:apiKey,"Content-Type":"application/json"},
        body:JSON.stringify({email,password,data:{first_name:firstName,last_name:lastName,role:"professor"}})
      });
      const data=await auth.json().catch(()=>({}));
      if(!auth.ok){
        const detail=String(data.code||data.error_code||data.msg||data.message||"");
        if(auth.status===429)return res.status(429).json({error:"email_rate_limited",message:"Trop de demandes. Réessayez plus tard."});
        if(/already registered|already been registered|user already exists|email_exists/i.test(detail))
          return res.status(409).json({error:"email_already_registered",message:"Cette adresse e-mail possède déjà un compte d’authentification."});
        console.error("Inscription professeur Supabase:",auth.status,detail);
        return res.status(503).json({error:"professor_registration_unavailable",message:"Le compte n’a pas pu être créé. Vérifiez le service de confirmation e-mail."});
      }

      const passwordHash=await bcrypt.hash(randomBytes(48).toString("hex"),12);
      const client=await pool.connect();
      try{
        await client.query("BEGIN");
        const invite=await client.query("SELECT id,user_id FROM professor_invites WHERE email=$1 FOR UPDATE",[email]);
        if(invite.rowCount&&invite.rows[0].user_id){
          await client.query("ROLLBACK");
          return res.status(409).json({error:"professor_account_already_linked",message:"Cette adresse est déjà reliée à un compte professeur."});
        }
        const created=await client.query(
          `INSERT INTO users(university_id,faculty_id,option_id,study_level_id,first_name,last_name,email,password_hash,role)
           VALUES(NULL,NULL,NULL,NULL,$1,$2,$3,$4,'professor') RETURNING id`,
          [firstName,lastName,email,passwordHash]
        );
        const userId=created.rows[0].id;
        let inviteId;
        if(invite.rowCount){
          inviteId=invite.rows[0].id;
          await client.query(
            "UPDATE professor_invites SET first_name=$1,last_name=$2,user_id=$3,activated_at=NOW(),is_active=TRUE WHERE id=$4",
            [firstName,lastName,userId,inviteId]
          );
        }else{
          const createdInvite=await client.query(
            "INSERT INTO professor_invites(email,first_name,last_name,user_id,activated_at,is_active) VALUES($1,$2,$3,$4,NOW(),TRUE) RETURNING id",
            [email,firstName,lastName,userId]
          );
          inviteId=createdInvite.rows[0].id;
        }
        const assigned=await client.query("SELECT 1 FROM professor_assignments WHERE invite_id=$1 AND is_active=TRUE AND course_id IS NOT NULL LIMIT 1",[inviteId]);
        await client.query(
          "INSERT INTO role_assignments(user_id,role,status) VALUES($1,'professor',$2) ON CONFLICT DO NOTHING",
          [userId,assigned.rowCount?"active":"pending"]
        );
        await client.query("COMMIT");
      }catch(error){
        await client.query("ROLLBACK").catch(()=>{});
        throw error;
      }finally{client.release();}
      return res.status(201).json({message:"Compte professeur créé. Confirmez votre adresse e-mail. Votre espace pédagogique sera activé après affectation."});
    }catch(error){
      console.error("Inscription professeur:",error?.message||error);
      return res.status(503).json({error:"professor_registration_unavailable",message:"L’inscription est temporairement indisponible."});
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
            "UPDATE role_assignments SET status=CASE WHEN EXISTS (SELECT 1 FROM professor_assignments pa WHERE pa.invite_id=$2 AND pa.is_active=TRUE AND pa.course_id IS NOT NULL) THEN 'active' ELSE 'pending' END,revoked_at=NULL,updated_at=NOW() WHERE user_id=$1 AND role='professor'",
            [r.rows[0].user_id,id]
          );
        }
      }
      return res.json({message:active?"Professeur réactivé.":"Accès professeur suspendu."});
    }catch{return res.status(503).json({error:"professor_status_failed"});}
  });
  router.get("/professor/assignments", requireAuth, async(req,res)=>{
    if(req.user.role!=="professor")return res.status(403).json({error:"professor_required"});
    try{
      await ensureSchema();
      const r=await pool.query(`
        SELECT u.name AS university_name,f.name AS faculty_name,o.name AS option_name,l.label AS level_label,c.id AS course_id,c.name AS course_name
        FROM professor_invites i JOIN professor_assignments a ON a.invite_id=i.id
        JOIN universities u ON u.id=a.university_id JOIN faculties f ON f.id=a.faculty_id
        JOIN options o ON o.id=a.option_id JOIN study_levels l ON l.id=a.study_level_id
        LEFT JOIN courses c ON c.id=a.course_id
        WHERE i.user_id=$1 AND i.is_active=TRUE AND a.is_active=TRUE ORDER BY u.name,f.name,o.name,l.sort_order
      `,[req.user.id]);
      return res.json({data:r.rows});
    }catch{return res.status(503).json({error:"professor_assignments_unavailable"});}
  });
  return router;
}
