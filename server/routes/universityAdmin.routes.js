import express from "express";
const idOf=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:null;};

export function createUniversityAdminRouter({pool,requireAuth}){
 const router=express.Router();
 async function scope(req,res,next){
  try{
   const r=await pool.query(`SELECT ra.id,ra.university_id,u.name AS university_name,u.code AS university_code
    FROM role_assignments ra JOIN universities u ON u.id=ra.university_id
    WHERE ra.user_id=$1 AND ra.role='university_admin' AND ra.status='active' AND u.is_active=TRUE
    ORDER BY u.name`,[req.user.id]);
   if(!r.rowCount)return res.status(403).json({error:"university_admin_required",message:"Aucune nomination active comme administrateur d’université."});
   req.universityScopes=r.rows;next();
  }catch{return res.status(503).json({error:"university_scope_unavailable"});}
 }
 router.get("/university-admin/overview",requireAuth,scope,async(req,res)=>{
  try{
   const ids=req.universityScopes.map(x=>x.university_id);
   const [fac,opts,students,prof,facultyManagers,programManagers,courses,docs,ann]=await Promise.all([
    pool.query("SELECT COUNT(*)::int total FROM faculties WHERE university_id=ANY($1::bigint[]) AND is_active=TRUE",[ids]),
    pool.query("SELECT COUNT(*)::int total FROM options o JOIN faculties f ON f.id=o.faculty_id WHERE f.university_id=ANY($1::bigint[]) AND o.is_active=TRUE",[ids]),
    pool.query("SELECT COUNT(*)::int total FROM users WHERE university_id=ANY($1::bigint[]) AND role IN ('student','delegate') AND is_active=TRUE",[ids]),
    pool.query("SELECT COUNT(DISTINCT pa.invite_id)::int total FROM professor_assignments pa WHERE pa.university_id=ANY($1::bigint[]) AND pa.is_active=TRUE",[ids]),
    pool.query("SELECT COUNT(DISTINCT ra.user_id)::int total FROM role_assignments ra WHERE ra.university_id=ANY($1::bigint[]) AND ra.role='faculty_manager' AND ra.status='active'",[ids]),
    pool.query("SELECT COUNT(DISTINCT ra.user_id)::int total FROM role_assignments ra WHERE ra.university_id=ANY($1::bigint[]) AND ra.role='program_manager' AND ra.status='active'",[ids]),
    pool.query("SELECT COUNT(*)::int total FROM courses c JOIN subjects s ON s.id=c.subject_id JOIN options o ON o.id=s.option_id JOIN faculties f ON f.id=o.faculty_id WHERE f.university_id=ANY($1::bigint[]) AND c.is_active=TRUE",[ids]),
    pool.query("SELECT COUNT(*)::int total FROM documents d WHERE d.university_id=ANY($1::bigint[]) AND d.is_active=TRUE",[ids]),
    pool.query("SELECT COUNT(*)::int total FROM announcements WHERE university_id=ANY($1::bigint[]) AND is_active=TRUE",[ids])
   ]);
   return res.json({data:{faculties:fac.rows[0].total,programs:opts.rows[0].total,students:students.rows[0].total,professors:prof.rows[0].total,facultyManagers:facultyManagers.rows[0].total,programManagers:programManagers.rows[0].total,courses:courses.rows[0].total,documents:docs.rows[0].total,announcements:ann.rows[0].total},scopes:req.universityScopes});
  }catch{return res.status(503).json({error:"university_overview_unavailable"});}
 });
 router.get("/university-admin/faculties",requireAuth,scope,async(req,res)=>{
  try{const r=await pool.query(`SELECT f.id,f.code,f.name,f.is_active,COUNT(DISTINCT o.id)::int programs,
    COUNT(DISTINCT ra.user_id)::int managers
    FROM faculties f LEFT JOIN options o ON o.faculty_id=f.id AND o.is_active=TRUE
    LEFT JOIN role_assignments ra ON ra.faculty_id=f.id AND ra.university_id=f.university_id AND ra.role='faculty_manager' AND ra.status='active'
    WHERE f.university_id=ANY($1::bigint[]) GROUP BY f.id ORDER BY f.name`,[req.universityScopes.map(x=>x.university_id)]);
   return res.json({data:r.rows});}catch{return res.status(503).json({error:"university_faculties_unavailable"});}
 });
 router.get("/university-admin/faculty-managers",requireAuth,scope,async(req,res)=>{
  try{const r=await pool.query(`SELECT ra.id assignment_id,ra.status,ra.created_at,u.id user_id,u.first_name,u.last_name,u.email,
    f.id faculty_id,f.name faculty_name
    FROM role_assignments ra JOIN users u ON u.id=ra.user_id JOIN faculties f ON f.id=ra.faculty_id
    WHERE ra.role='faculty_manager' AND ra.university_id=ANY($1::bigint[])
    ORDER BY f.name,u.last_name,u.first_name`,[req.universityScopes.map(x=>x.university_id)]);
   return res.json({data:r.rows});}catch{return res.status(503).json({error:"faculty_managers_unavailable"});}
 });
 router.post("/university-admin/faculty-managers",requireAuth,scope,async(req,res)=>{
  const email=typeof req.body?.email==="string"?req.body.email.trim().toLowerCase():"",facultyId=idOf(req.body?.facultyId);
  if(!facultyId||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return res.status(400).json({error:"invalid_faculty_manager"});
  const client=await pool.connect();
  try{
   await client.query("BEGIN");
   const f=await client.query("SELECT id,university_id,name FROM faculties WHERE id=$1 AND university_id=ANY($2::bigint[]) AND is_active=TRUE FOR UPDATE",[facultyId,req.universityScopes.map(x=>x.university_id)]);
   if(!f.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"faculty_not_found"});}
   const user=await client.query("SELECT id,is_active FROM users WHERE email=$1",[email]);
   if(!user.rowCount||!user.rows[0].is_active){await client.query("ROLLBACK");return res.status(404).json({error:"account_not_found",message:"La personne doit d’abord créer un compte iFac actif."});}
   const active=await client.query("SELECT id FROM role_assignments WHERE user_id=$1 AND role='faculty_manager' AND university_id=$2 AND faculty_id=$3 AND status='active' LIMIT 1",[user.rows[0].id,f.rows[0].university_id,facultyId]);
   if(active.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"already_assigned",message:"Cette personne est déjà responsable de cette faculté."});}
   const count=await client.query("SELECT COUNT(*)::int total FROM role_assignments WHERE role='faculty_manager' AND university_id=$1 AND faculty_id=$2 AND status='active'",[f.rows[0].university_id,facultyId]);
   if(count.rows[0].total>=4){await client.query("ROLLBACK");return res.status(409).json({error:"faculty_manager_limit",message:"La limite de quatre responsables actifs pour cette faculté est atteinte."});}
   const old=await client.query("SELECT id FROM role_assignments WHERE user_id=$1 AND role='faculty_manager' AND university_id=$2 AND faculty_id=$3 AND status='revoked' ORDER BY id DESC LIMIT 1 FOR UPDATE",[user.rows[0].id,f.rows[0].university_id,facultyId]);
   const a=old.rowCount?await client.query("UPDATE role_assignments SET status='active',assigned_by=$1,approved_by=$1,revoked_at=NULL,updated_at=NOW() WHERE id=$2 RETURNING id,status",[req.user.id,old.rows[0].id]):await client.query("INSERT INTO role_assignments(user_id,role,university_id,faculty_id,status,assigned_by,approved_by) VALUES($1,'faculty_manager',$2,$3,'active',$4,$4) RETURNING id,status",[user.rows[0].id,f.rows[0].university_id,facultyId,req.user.id]);
   await client.query("INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,university_id,faculty_id,metadata) VALUES($1,'faculty_manager.appointed','role_assignment',$2,$3,$4,$5::jsonb)",[req.user.id,a.rows[0].id,f.rows[0].university_id,facultyId,JSON.stringify({email})]);
   await client.query("COMMIT");return res.status(201).json({message:"Responsable de faculté nommé.",assignment:a.rows[0]});
  }catch(e){await client.query("ROLLBACK").catch(()=>{});console.error(e?.message);return res.status(503).json({error:"faculty_manager_appointment_failed"});}
  finally{client.release();}
 });
 router.patch("/university-admin/faculty-managers/:id/status",requireAuth,scope,async(req,res)=>{
  const id=idOf(req.params.id),active=req.body?.active;if(!id||typeof active!=="boolean")return res.status(400).json({error:"invalid_assignment"});
  try{const r=await pool.query(`UPDATE role_assignments ra SET status=CASE WHEN $1 THEN 'active' ELSE 'revoked' END,
    assigned_by=CASE WHEN $1 THEN COALESCE(ra.assigned_by,$4) ELSE ra.assigned_by END,
    approved_by=CASE WHEN $1 THEN $4 ELSE ra.approved_by END,
    revoked_at=CASE WHEN $1 THEN NULL ELSE NOW() END,updated_at=NOW()
    WHERE ra.id=$2 AND ra.role='faculty_manager' AND ra.university_id=ANY($3::bigint[]) RETURNING ra.id,ra.status,ra.faculty_id,ra.university_id`,
    [active,id,req.universityScopes.map(x=>x.university_id),req.user.id]);
   if(!r.rowCount)return res.status(404).json({error:"assignment_not_found"});
   if(active){const count=await pool.query("SELECT COUNT(*)::int total FROM role_assignments WHERE role='faculty_manager' AND university_id=$1 AND faculty_id=$2 AND status='active'",[r.rows[0].university_id,r.rows[0].faculty_id]);if(count.rows[0].total>4){await pool.query("UPDATE role_assignments SET status='revoked',revoked_at=NOW() WHERE id=$1",[id]);return res.status(409).json({error:"faculty_manager_limit"});}}
   await pool.query("INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,university_id,faculty_id,metadata) VALUES($1,$2,'role_assignment',$3,$4,$5,$6::jsonb)",[req.user.id,active?"faculty_manager.reactivated":"faculty_manager.revoked",id,r.rows[0].university_id,r.rows[0].faculty_id,JSON.stringify({status:r.rows[0].status})]);
   return res.json({assignment:r.rows[0],message:active?"Nomination réactivée.":"Accès retiré."});
  }catch{return res.status(503).json({error:"faculty_manager_status_failed"});}
 });
 router.get("/university-admin/announcements",requireAuth,scope,async(req,res)=>{
  try{const r=await pool.query("SELECT id,title,body,created_at,is_active FROM announcements WHERE university_id=ANY($1::bigint[]) ORDER BY created_at DESC LIMIT 300",[req.universityScopes.map(x=>x.university_id)]);return res.json({data:r.rows});}
  catch{return res.status(503).json({error:"university_announcements_unavailable"});}
 });
 router.post("/university-admin/announcements",requireAuth,scope,async(req,res)=>{
  const title=typeof req.body?.title==="string"?req.body.title.trim():"",body=typeof req.body?.body==="string"?req.body.body.trim():"";
  if(!title||title.length>220||!body||body.length>20000)return res.status(400).json({error:"invalid_announcement"});
  const assignmentId=idOf(req.body?.scopeAssignmentId);
  const selectedScope=assignmentId
    ? req.universityScopes.find(x=>Number(x.id)===assignmentId)
    : req.universityScopes.length===1?req.universityScopes[0]:null;
  if(!selectedScope)return res.status(403).json({error:"university_scope_forbidden",message:"Sélectionnez une université que vous administrez."});
  const universityId=selectedScope.university_id;
  try{const r=await pool.query("INSERT INTO announcements(university_id,title,body,is_active,created_by,starts_at) VALUES($1,$2,$3,TRUE,$4,NOW()) RETURNING id,title,body,created_at,is_active",[universityId,title,body,req.user.id]);return res.status(201).json({announcement:r.rows[0],message:"Annonce publiée dans votre université."});}
  catch{return res.status(503).json({error:"announcement_create_failed"});}
 });
 return router;
}
