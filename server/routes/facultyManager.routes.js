import express from "express";

const positiveId = value => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export function createFacultyManagerRouter({ pool, requireAuth }) {
  const router = express.Router();

  async function requireFacultyManager(req, res, next) {
    try {
      const result = await pool.query(`
        SELECT ra.id AS role_assignment_id,ra.university_id,ra.faculty_id,
               u.name AS university_name,f.name AS faculty_name
        FROM role_assignments ra
        JOIN universities u ON u.id=ra.university_id
        JOIN faculties f ON f.id=ra.faculty_id AND f.university_id=u.id
        WHERE ra.user_id=$1 AND ra.role='faculty_manager' AND ra.status='active'
          AND u.is_active=TRUE AND f.is_active=TRUE
        ORDER BY u.name,f.name
      `,[req.user.id]);
      if (!result.rowCount) return res.status(403).json({
        error:"faculty_manager_required",
        message:"Votre compte ne possède pas de nomination active comme responsable de faculté."
      });
      req.facultyScopes=result.rows;
      next();
    } catch {
      return res.status(503).json({error:"faculty_scope_unavailable"});
    }
  }

  router.get("/faculty-manager/overview",requireAuth,requireFacultyManager,async(req,res)=>{
    try {
      const [students,programs,managers,courses,documents,professors]=await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS total FROM users u
          WHERE u.is_active=TRUE AND u.role IN ('student','delegate')
            AND EXISTS (SELECT 1 FROM role_assignments ra WHERE ra.user_id=$1
              AND ra.role='faculty_manager' AND ra.status='active'
              AND ra.university_id=u.university_id AND ra.faculty_id=u.faculty_id)`,[req.user.id]),
        pool.query(`SELECT COUNT(*)::int AS total FROM options o
          JOIN faculties f ON f.id=o.faculty_id
          WHERE o.is_active=TRUE AND EXISTS (SELECT 1 FROM role_assignments ra
            WHERE ra.user_id=$1 AND ra.role='faculty_manager' AND ra.status='active'
              AND ra.university_id=f.university_id AND ra.faculty_id=f.id)`,[req.user.id]),
        pool.query(`SELECT COUNT(DISTINCT pm.user_id)::int AS total FROM role_assignments pm
          WHERE pm.role='program_manager' AND pm.status='active'
            AND EXISTS (SELECT 1 FROM role_assignments fm WHERE fm.user_id=$1
              AND fm.role='faculty_manager' AND fm.status='active'
              AND fm.university_id=pm.university_id AND fm.faculty_id=pm.faculty_id)`,[req.user.id]),
        pool.query(`SELECT COUNT(*)::int AS total FROM courses c
          JOIN subjects s ON s.id=c.subject_id JOIN options o ON o.id=s.option_id
          JOIN faculties f ON f.id=o.faculty_id
          WHERE c.is_active=TRUE AND EXISTS (SELECT 1 FROM role_assignments ra
            WHERE ra.user_id=$1 AND ra.role='faculty_manager' AND ra.status='active'
              AND ra.university_id=f.university_id AND ra.faculty_id=f.id)`,[req.user.id]),
        pool.query(`SELECT COUNT(*)::int AS total FROM documents d
          WHERE d.is_active=TRUE AND d.storage_bucket='class-documents'
            AND EXISTS (SELECT 1 FROM role_assignments ra WHERE ra.user_id=$1
              AND ra.role='faculty_manager' AND ra.status='active'
              AND ra.university_id=d.university_id AND ra.faculty_id=d.faculty_id)`,[req.user.id]),
        pool.query(`SELECT COUNT(DISTINCT i.id)::int AS total FROM professor_invites i
          JOIN professor_assignments pa ON pa.invite_id=i.id AND pa.is_active=TRUE
          WHERE EXISTS (SELECT 1 FROM role_assignments ra WHERE ra.user_id=$1
            AND ra.role='faculty_manager' AND ra.status='active'
            AND ra.university_id=pa.university_id AND ra.faculty_id=pa.faculty_id)`,[req.user.id])
      ]);
      return res.json({
        data:{
          students:students.rows[0].total,programs:programs.rows[0].total,
          programManagers:managers.rows[0].total,courses:courses.rows[0].total,
          documents:documents.rows[0].total,professors:professors.rows[0].total
        },
        scopes:req.facultyScopes
      });
    } catch {
      return res.status(503).json({error:"faculty_overview_unavailable"});
    }
  });

  router.get("/faculty-manager/programs",requireAuth,requireFacultyManager,async(req,res)=>{
    try {
      const result=await pool.query(`SELECT o.id,o.name,o.code,f.name AS faculty_name,
          COUNT(DISTINCT l.id)::int AS active_levels,
          COUNT(DISTINCT s.id)::int AS subjects,
          COUNT(DISTINCT c.id)::int AS courses
        FROM options o JOIN faculties f ON f.id=o.faculty_id
        LEFT JOIN study_levels l ON l.option_id=o.id AND l.is_active=TRUE
        LEFT JOIN subjects s ON s.option_id=o.id AND s.is_active=TRUE
        LEFT JOIN courses c ON c.subject_id=s.id AND c.is_active=TRUE
        WHERE o.is_active=TRUE AND EXISTS (SELECT 1 FROM role_assignments ra
          WHERE ra.user_id=$1 AND ra.role='faculty_manager' AND ra.status='active'
            AND ra.university_id=f.university_id AND ra.faculty_id=f.id)
        GROUP BY o.id,f.name ORDER BY o.name`,[req.user.id]);
      const levels=await pool.query(`SELECT l.id,l.option_id,l.label,l.sort_order
        FROM study_levels l JOIN options o ON o.id=l.option_id JOIN faculties f ON f.id=o.faculty_id
        WHERE l.is_active=TRUE AND o.is_active=TRUE AND EXISTS (
          SELECT 1 FROM role_assignments ra WHERE ra.user_id=$1 AND ra.role='faculty_manager'
            AND ra.status='active' AND ra.university_id=f.university_id AND ra.faculty_id=f.id)
        ORDER BY o.name,l.sort_order`,[req.user.id]);
      return res.json({data:{programs:result.rows,levels:levels.rows}});
    } catch {
      return res.status(503).json({error:"faculty_programs_unavailable"});
    }
  });

  router.get("/faculty-manager/program-managers",requireAuth,requireFacultyManager,async(req,res)=>{
    try {
      const result=await pool.query(`SELECT ra.id AS assignment_id,ra.user_id,ra.status,ra.created_at,
          u.first_name,u.last_name,u.email,o.id AS option_id,o.name AS option_name,
          l.id AS study_level_id,l.label AS level_label,un.name AS university_name,f.name AS faculty_name
        FROM role_assignments ra JOIN users u ON u.id=ra.user_id
        JOIN options o ON o.id=ra.option_id JOIN faculties f ON f.id=ra.faculty_id
        JOIN universities un ON un.id=ra.university_id
        LEFT JOIN study_levels l ON l.id=ra.study_level_id
        WHERE ra.role='program_manager' AND EXISTS (
          SELECT 1 FROM role_assignments fm WHERE fm.user_id=$1 AND fm.role='faculty_manager'
            AND fm.status='active' AND fm.university_id=ra.university_id AND fm.faculty_id=ra.faculty_id)
        ORDER BY o.name,l.sort_order NULLS FIRST,u.last_name,u.first_name LIMIT 500`,[req.user.id]);
      return res.json({data:result.rows});
    } catch {
      return res.status(503).json({error:"program_managers_unavailable"});
    }
  });

  router.post("/faculty-manager/program-managers",requireAuth,requireFacultyManager,async(req,res)=>{
    const email=typeof req.body?.email==="string"?req.body.email.trim().toLowerCase():"";
    const optionId=positiveId(req.body?.optionId);
    const studyLevelId=req.body?.studyLevelId?positiveId(req.body.studyLevelId):null;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!optionId||
      (req.body.studyLevelId && !studyLevelId))
      return res.status(400).json({error:"invalid_program_manager",message:"Saisissez un e-mail valide et sélectionnez un programme."});
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const option=await client.query(`SELECT o.id,f.id AS faculty_id,f.university_id
        FROM options o JOIN faculties f ON f.id=o.faculty_id
        WHERE o.id=$1 AND o.is_active=TRUE AND f.is_active=TRUE
          AND EXISTS (SELECT 1 FROM role_assignments fm WHERE fm.user_id=$2
            AND fm.role='faculty_manager' AND fm.status='active'
            AND fm.university_id=f.university_id AND fm.faculty_id=f.id)
        FOR UPDATE OF o`,[optionId,req.user.id]);
      if(!option.rowCount){await client.query("ROLLBACK");return res.status(403).json({error:"program_outside_faculty_scope"});}
      if(studyLevelId){
        const level=await client.query("SELECT id FROM study_levels WHERE id=$1 AND option_id=$2 AND is_active=TRUE",[studyLevelId,optionId]);
        if(!level.rowCount){await client.query("ROLLBACK");return res.status(400).json({error:"invalid_study_level"});}
      }
      const user=await client.query("SELECT id,is_active FROM users WHERE email=$1",[email]);
      if(!user.rowCount || !user.rows[0].is_active){await client.query("ROLLBACK");return res.status(404).json({error:"account_not_found",message:"Aucun compte iFac actif ne correspond à cet e-mail. La personne doit d’abord créer son compte."});}
      const overlap=await client.query(`SELECT id FROM role_assignments
        WHERE user_id=$1 AND role='program_manager' AND status='active'
          AND university_id=$2 AND faculty_id=$3 AND option_id=$4
          AND (study_level_id IS NULL OR $5::bigint IS NULL OR study_level_id=$5)
        LIMIT 1`,[user.rows[0].id,option.rows[0].university_id,option.rows[0].faculty_id,optionId,studyLevelId]);
      if(overlap.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"program_manager_already_assigned",message:"Cette personne possède déjà une nomination active couvrant ce programme ou ce niveau."});}
      const revoked=await client.query(`SELECT id FROM role_assignments
        WHERE user_id=$1 AND role='program_manager' AND status='revoked'
          AND university_id=$2 AND faculty_id=$3 AND option_id=$4
          AND study_level_id IS NOT DISTINCT FROM $5
        ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [user.rows[0].id,option.rows[0].university_id,option.rows[0].faculty_id,optionId,studyLevelId]);
      let assignment;
      if(revoked.rowCount){
        assignment=await client.query(`UPDATE role_assignments SET status='active',assigned_by=$1,
          approved_by=$1,revoked_at=NULL,updated_at=NOW() WHERE id=$2 RETURNING id,status`,
          [req.user.id,revoked.rows[0].id]);
      }else{
        assignment=await client.query(`INSERT INTO role_assignments
          (user_id,role,university_id,faculty_id,option_id,study_level_id,status,assigned_by,approved_by)
          VALUES($1,'program_manager',$2,$3,$4,$5,'active',$6,$6) RETURNING id,status`,
          [user.rows[0].id,option.rows[0].university_id,option.rows[0].faculty_id,optionId,studyLevelId,req.user.id]);
      }
      await client.query(`INSERT INTO admin_audit_logs
        (actor_user_id,action,target_type,target_id,university_id,faculty_id,option_id,study_level_id,metadata)
        VALUES($1,'program_manager.appointed','role_assignment',$2,$3,$4,$5,$6,$7::jsonb)`,
        [req.user.id,assignment.rows[0].id,option.rows[0].university_id,option.rows[0].faculty_id,optionId,studyLevelId,JSON.stringify({userId:user.rows[0].id,email})]);
      await client.query("COMMIT");
      return res.status(201).json({message:"Responsable de programme nommé et accès activé.",assignment:assignment.rows[0]});
    }catch(error){
      await client.query("ROLLBACK").catch(()=>{});
      return res.status(503).json({error:"program_manager_appointment_failed"});
    }finally{client.release();}
  });

  router.patch("/faculty-manager/program-managers/:assignmentId/status",requireAuth,requireFacultyManager,async(req,res)=>{
    const assignmentId=positiveId(req.params.assignmentId),active=req.body?.active;
    if(!assignmentId||typeof active!=="boolean")return res.status(400).json({error:"invalid_assignment_status"});
    try{
      const result=await pool.query(`UPDATE role_assignments ra SET
          status=CASE WHEN $1 THEN 'active' ELSE 'revoked' END,
          revoked_at=CASE WHEN $1 THEN NULL ELSE NOW() END,updated_at=NOW()
        WHERE ra.id=$2 AND ra.role='program_manager' AND EXISTS (
          SELECT 1 FROM role_assignments fm WHERE fm.user_id=$3 AND fm.role='faculty_manager'
            AND fm.status='active' AND fm.university_id=ra.university_id AND fm.faculty_id=ra.faculty_id)
        RETURNING ra.id,ra.status`,[active,assignmentId,req.user.id]);
      if(!result.rowCount)return res.status(404).json({error:"program_manager_assignment_not_found"});
      await pool.query(`INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,metadata)
        VALUES($1,$2,'role_assignment',$3,$4::jsonb)`,
        [req.user.id,active?"program_manager.reactivated":"program_manager.revoked",assignmentId,JSON.stringify({status:result.rows[0].status})]);
      return res.json({assignment:result.rows[0],message:active?"Nomination réactivée.":"Nomination retirée."});
    }catch{
      return res.status(503).json({error:"program_manager_status_failed"});
    }
  });

  router.get("/faculty-manager/professors",requireAuth,requireFacultyManager,async(req,res)=>{
    try{
      const result=await pool.query(`SELECT DISTINCT i.id,i.email,i.first_name,i.last_name,
          i.activated_at,i.is_active,COUNT(DISTINCT pa.course_id)::int AS courses
        FROM professor_invites i JOIN professor_assignments pa ON pa.invite_id=i.id
        WHERE EXISTS (SELECT 1 FROM role_assignments fm WHERE fm.user_id=$1
          AND fm.role='faculty_manager' AND fm.status='active'
          AND fm.university_id=pa.university_id AND fm.faculty_id=pa.faculty_id)
        GROUP BY i.id ORDER BY i.last_name,i.first_name LIMIT 500`,[req.user.id]);
      return res.json({data:result.rows});
    }catch{return res.status(503).json({error:"faculty_professors_unavailable"});}
  });

  router.get("/faculty-manager/documents",requireAuth,requireFacultyManager,async(req,res)=>{
    try{
      const result=await pool.query(`SELECT d.id,d.title,d.course,d.professor,d.description,
          d.file_name,d.status,d.created_at,o.name AS option_name,l.label AS level_label
        FROM documents d LEFT JOIN options o ON o.id=d.option_id
        LEFT JOIN study_levels l ON l.id=d.study_level_id
        WHERE d.is_active=TRUE AND d.storage_bucket='class-documents'
          AND EXISTS (SELECT 1 FROM role_assignments fm WHERE fm.user_id=$1
            AND fm.role='faculty_manager' AND fm.status='active'
            AND fm.university_id=d.university_id AND fm.faculty_id=d.faculty_id)
        ORDER BY d.created_at DESC LIMIT 500`,[req.user.id]);
      return res.json({data:result.rows});
    }catch{return res.status(503).json({error:"faculty_documents_unavailable"});}
  });

  return router;
}
