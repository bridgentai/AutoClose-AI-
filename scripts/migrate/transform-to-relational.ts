/**
 * Phase 2 - Transform exported Mongo JSON to relational tables (UUID v5 from ObjectId).
 * Reads scripts/migrate/data/*.json, writes scripts/migrate/out/*.json per PG table.
 * Run: npx tsx scripts/migrate/transform-to-relational.ts
 */

import { resolve } from 'path';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { v5 as uuidV5 } from 'uuid';

const DATA_DIR = resolve(process.cwd(), 'scripts/migrate/data');
const OUT_DIR = resolve(process.cwd(), 'scripts/migrate/out');
const NAMESPACE = uuidV5('evoos-migration', uuidV5.DNS);

function toUUID(oid: string): string {
  if (!oid || typeof oid !== 'string') return '';
  const hex = oid.replace(/^ObjectId\(|\)$/g, '').trim();
  if (hex.length !== 24) return '';
  return uuidV5(hex, NAMESPACE);
}

function loadJson<T = unknown>(name: string): T[] {
  try {
    const raw = readFileSync(resolve(DATA_DIR, `${name}.json`), 'utf-8');
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

type Record = Record<string, unknown>;

function run() {
  mkdirSync(OUT_DIR, { recursive: true });

  const configInstitucion = loadJson<Record & { _id: string; colegioId: string; nombre: string }>('config_institucion');
  const codigosInstitucion = loadJson<Record>('codigos_institucion');
  const usuarios = loadJson<Record>('usuarios');
  const secciones = loadJson<Record>('secciones');
  const materias = loadJson<Record>('materias');
  const grupos = loadJson<Record>('grupos');
  const grupoEstudiantes = loadJson<Record>('grupo_estudiantes');
  const cursos = loadJson<Record>('cursos');
  const tareas = loadJson<Record>('tareas');
  const notas = loadJson<Record>('notas');
  const asistencias = loadJson<Record>('asistencias');
  const gradeEvents = loadJson<Record>('grade_events');
  const gradingSchemas = loadJson<Record>('grading_schemas');
  const gradingCategories = loadJson<Record>('grading_categories');
  const conversaciones = loadJson<Record>('conversaciones');
  const mensajes = loadJson<Record>('mensajes');
  const notificaciones = loadJson<Record>('notificaciones');
  const eventos = loadJson<Record>('eventos');
  const vinculaciones = loadJson<Record>('vinculaciones');
  const chats = loadJson<Record>('chats');
  const chatMessages = loadJson<Record>('chat_messages');
  const evoThreads = loadJson<Record>('evo_threads');
  const evoMessages = loadJson<Record>('evo_messages');
  const materiales = loadJson<Record>('materiales');
  const assignmentMaterials = loadJson<Record>('assignment_materials');
  const performanceSnapshots = loadJson<Record>('performance_snapshots');
  const performanceForecasts = loadJson<Record>('performance_forecasts');
  const riskAssessments = loadJson<Record>('risk_assessments');
  const aiActionLogs = loadJson<Record>('ai_action_logs');
  const groupSchedules = loadJson<Record>('group_schedules');
  const professorSchedules = loadJson<Record>('professor_schedules');

  const colegioIdToInstitutionId: Record<string, string> = {};
  const institutionIds = new Set<string>();

  // 1) institutions from config_institucion
  const institutions = configInstitucion.map((c) => {
    const id = toUUID(String(c._id));
    const colegioId = String(c.colegioId || '');
    if (colegioId) colegioIdToInstitutionId[colegioId] = id;
    institutionIds.add(id);
    return {
      id,
      name: (c.nombre as string) || '',
      slug: colegioId || null,
      settings: c.parametros ?? {},
      created_at: (c.createdAt as string) || new Date().toISOString(),
      updated_at: (c.updatedAt as string) || new Date().toISOString(),
    };
  });
  writeFileSync(resolve(OUT_DIR, 'institutions.json'), JSON.stringify(institutions));

  // Default institution if none
  const defaultInstId = institutions[0]?.id || uuidV5('default-institution', NAMESPACE);
  if (institutions.length === 0) {
    institutions.push({
      id: defaultInstId,
      name: 'Default',
      slug: 'default',
      settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    writeFileSync(resolve(OUT_DIR, 'institutions.json'), JSON.stringify(institutions));
  }

  // 2) academic_periods (one per institution)
  const academicPeriods: Record[] = [];
  const now = new Date();
  const startDate = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const endDate = new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
  for (const inst of institutions) {
    academicPeriods.push({
      id: uuidV5(`period-${inst.id}`, NAMESPACE),
      institution_id: inst.id,
      name: `${now.getFullYear()}-1`,
      start_date: startDate,
      end_date: endDate,
      is_active: true,
      created_at: now.toISOString(),
    });
  }
  writeFileSync(resolve(OUT_DIR, 'academic_periods.json'), JSON.stringify(academicPeriods));
  const defaultPeriodId = academicPeriods[0]?.id as string;

  // 3) users
  const users = usuarios.map((u) => {
    const id = toUUID(String(u._id));
    const colegioId = String(u.colegioId || '');
    const institution_id = colegioIdToInstitutionId[colegioId] || defaultInstId;
    return {
      id,
      institution_id,
      email: (u.email as string) || (u.correo as string) || '',
      password_hash: (u.password as string) || '',
      full_name: (u.nombre as string) || '',
      role: (u.rol as string) || 'estudiante',
      status: (u.estado as string) || 'active',
      internal_code: (u.codigoInterno as string) || (u.codigoUnico as string) || null,
      phone: (u.telefono as string) || (u.celular as string) || null,
      date_of_birth: (u.fechaNacimiento as string) || null,
      consent_terms: !!u.consentimientoTerminos,
      consent_privacy: !!u.consentimientoPrivacidad,
      consent_at: (u.consentimientoFecha as string) || null,
      config: {
        ...(typeof (u as Record).configuraciones === 'object' && (u as Record).configuraciones !== null ? (u as Record).configuraciones as Record<string, unknown> : {}),
        ...((u as Record).curso != null && { curso: String((u as Record).curso) }),
        ...(Array.isArray((u as Record).materias) && { materias: (u as Record).materias as string[] }),
      },
      created_at: (u.createdAt as string) || now.toISOString(),
      updated_at: (u.updatedAt as string) || now.toISOString(),
    };
  });
  writeFileSync(resolve(OUT_DIR, 'users.json'), JSON.stringify(users));

  const userIdMap = new Map(users.map((u) => [(u as Record).id as string, u]));

  // 4) institution_codes
  const institutionCodes = codigosInstitucion.map((c) => ({
    id: toUUID(String((c as Record & { _id: string })._id)) || uuidV5(`code-${c.colegioId}-${c.codigo}`, NAMESPACE),
    institution_id: colegioIdToInstitutionId[String(c.colegioId)] || defaultInstId,
    code: String(c.codigo),
    role_assigned: String(c.rolAsignado),
  }));
  writeFileSync(resolve(OUT_DIR, 'institution_codes.json'), JSON.stringify(institutionCodes));

  // 5) sections
  const sections = secciones.map((s) => ({
    id: toUUID(String(s._id)),
    institution_id: colegioIdToInstitutionId[String(s.colegioId)] || defaultInstId,
    name: (s.nombre as string) || '',
    created_at: (s.createdAt as string) || now.toISOString(),
    updated_at: (s.updatedAt as string) || now.toISOString(),
  }));
  writeFileSync(resolve(OUT_DIR, 'sections.json'), JSON.stringify(sections));
  const defaultSectionId = sections[0]?.id as string;

  // 6) subjects (materias) - need institution_id; materias don't have colegioId, use default
  const subjects = materias.map((m) => ({
    id: toUUID(String(m._id)),
    institution_id: defaultInstId,
    name: (m.nombre as string) || '',
    description: (m.descripcion as string) || null,
    area: (m.area as string) || null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }));
  writeFileSync(resolve(OUT_DIR, 'subjects.json'), JSON.stringify(subjects));

  // 7) groups
  const groups = grupos.map((g) => ({
    id: toUUID(String(g._id)),
    institution_id: colegioIdToInstitutionId[String(g.colegioId)] || defaultInstId,
    section_id: g.sectionId ? toUUID(String(g.sectionId)) : defaultSectionId,
    name: (g.nombre as string) || '',
    description: (g.descripcion as string) || null,
    academic_period_id: defaultPeriodId,
    created_at: (g.createdAt as string) || now.toISOString(),
    updated_at: (g.updatedAt as string) || now.toISOString(),
  }));
  writeFileSync(resolve(OUT_DIR, 'groups.json'), JSON.stringify(groups));

  // 8) group_subjects from cursos (each course = one group_subject: group from course name match or create; we'll use course -> group by creating group per course if not exists)
  const courseIdToGroupId: Record<string, string> = {};
  const courseIdToGroupSubjectId = new Map<string, string>();
  const groupByName = new Map(groups.map((g) => [(g as Record).name as string, (g as Record).id as string]));
  const groupSubjects: Record[] = [];
  for (const course of cursos) {
    const courseId = String(course._id);
    const courseName = (course.nombre as string) || '';
    let groupId = courseIdToGroupId[courseId] || groupByName.get(courseName);
    if (!groupId) {
      const newGroupId = toUUID(courseId);
      courseIdToGroupId[courseId] = newGroupId;
      groupId = newGroupId;
      groups.push({
        id: newGroupId,
        institution_id: colegioIdToInstitutionId[String(course.colegioId)] || defaultInstId,
        section_id: defaultSectionId,
        name: courseName || 'Group',
        description: null,
        academic_period_id: defaultPeriodId,
        created_at: (course.createdAt as string) || now.toISOString(),
        updated_at: now.toISOString(),
      });
    }
    const materiaId = course.materiaId ? toUUID(String(course.materiaId)) : null;
    const teacherId = (course.profesorId && toUUID(String(course.profesorId))) || (course.profesorIds && (course.profesorIds as string[])[0] ? toUUID(String((course.profesorIds as string[])[0])) : null);
    if (materiaId && teacherId) {
      const gsId = uuidV5('gs-' + courseId, NAMESPACE);
      const institutionId = colegioIdToInstitutionId[String(course.colegioId)] || defaultInstId;
      courseIdToGroupSubjectId.set(courseId, gsId);
      groupSubjects.push({
        id: gsId,
        institution_id: institutionId,
        group_id: groupId,
        subject_id: materiaId,
        teacher_id: teacherId,
        created_at: (course.createdAt as string) || now.toISOString(),
      });
    }
  }
  writeFileSync(resolve(OUT_DIR, 'group_subjects.json'), JSON.stringify(groupSubjects));
  writeFileSync(resolve(OUT_DIR, 'groups.json'), JSON.stringify(groups));

  // 9) enrollments from grupo_estudiantes and course.estudiantes/estudianteIds
  const enrollments: Record[] = [];
  const seenEnrollment = new Set<string>();
  for (const ge of grupoEstudiantes) {
    const studentId = toUUID(String(ge.estudianteId));
    const groupId = toUUID(String(ge.grupoId));
    const key = `${studentId}-${groupId}-${defaultPeriodId}`;
    if (seenEnrollment.has(key)) continue;
    seenEnrollment.add(key);
    enrollments.push({
      id: uuidV5(key, NAMESPACE),
      student_id: studentId,
      group_id: groupId,
      academic_period_id: defaultPeriodId,
      created_at: (ge.createdAt as string) || now.toISOString(),
    });
  }
  for (const course of cursos) {
    const groupId = courseIdToGroupId[String(course._id)] || groupByName.get((course.nombre as string) || '') || toUUID(String(course._id));
    const students = (course.estudiantes as string[] | undefined) || (course.estudianteIds as string[] | undefined) || [];
    for (const s of students) {
      const studentId = toUUID(String(s));
      const key = `${studentId}-${groupId}-${defaultPeriodId}`;
      if (seenEnrollment.has(key)) continue;
      seenEnrollment.add(key);
      enrollments.push({
        id: uuidV5(key, NAMESPACE),
        student_id: studentId,
        group_id: groupId,
        academic_period_id: defaultPeriodId,
        created_at: (course.createdAt as string) || now.toISOString(),
      });
    }
  }
  writeFileSync(resolve(OUT_DIR, 'enrollments.json'), JSON.stringify(enrollments));

  // 10) assignment_categories (from logros_calificacion if needed) - minimal seed
  const assignmentCategories: Record[] = [
    { id: uuidV5('cat-homework', NAMESPACE), institution_id: defaultInstId, name: 'Homework', created_at: now.toISOString() },
    { id: uuidV5('cat-quiz', NAMESPACE), institution_id: defaultInstId, name: 'Quiz', created_at: now.toISOString() },
    { id: uuidV5('cat-exam', NAMESPACE), institution_id: defaultInstId, name: 'Exam', created_at: now.toISOString() },
  ];
  writeFileSync(resolve(OUT_DIR, 'assignment_categories.json'), JSON.stringify(assignmentCategories));
  const defaultAssignmentCategoryId = assignmentCategories[0].id as string;

  // 11) grading_schemas (courseId -> group_id in PG)
  const gradingSchemasOut = gradingSchemas.map((g) => ({
    id: toUUID(String(g._id)),
    group_id: g.courseId ? (courseIdToGroupId[String(g.courseId)] || toUUID(String(g.courseId))) : null,
    institution_id: colegioIdToInstitutionId[String(g.colegioId)] || defaultInstId,
    name: (g.nombre as string) || null,
    version: (g.version as number) ?? 1,
    is_active: g.isActive !== false,
    created_at: (g.createdAt as string) || now.toISOString(),
    updated_at: (g.updatedAt as string) || now.toISOString(),
  })).filter((g) => g.group_id);
  // Si no hay esquemas de calificación en origen, creamos uno por defecto
  if (gradingSchemasOut.length === 0 && groups.length > 0) {
    const firstGroupId = (groups[0] as Record).id as string;
    gradingSchemasOut.push({
      id: uuidV5('default-grading-schema', NAMESPACE),
      group_id: firstGroupId,
      institution_id: defaultInstId,
      name: 'Default grading schema',
      version: 1,
      is_active: true,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
  }

  // 12) grading_categories
  const gradingCategoriesOut = gradingCategories.map((c) => ({
    id: toUUID(String(c._id)),
    grading_schema_id: toUUID(String(c.gradingSchemaId)),
    institution_id: (c.colegioId && colegioIdToInstitutionId[String(c.colegioId)]) || defaultInstId,
    name: (c.nombre as string) || '',
    weight: (c.weight as number) ?? 100,
    sort_order: (c.orden as number) ?? 0,
    evaluation_type: (c.evaluationType as string) || 'summative',
    risk_impact_multiplier: (c.riskImpactMultiplier as number) ?? 1,
    created_at: (c.createdAt as string) || now.toISOString(),
    updated_at: (c.updatedAt as string) || now.toISOString(),
  }));
  // Si no hay categorías de calificación en origen, creamos una por defecto
  if (gradingCategoriesOut.length === 0 && gradingSchemasOut.length > 0) {
    gradingCategoriesOut.push({
      id: uuidV5('default-grading-category', NAMESPACE),
      grading_schema_id: gradingSchemasOut[0].id as string,
      institution_id: defaultInstId,
      name: 'Default',
      weight: 100,
      sort_order: 0,
      evaluation_type: 'summative',
      risk_impact_multiplier: 1,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
  }
  writeFileSync(resolve(OUT_DIR, 'grading_schemas.json'), JSON.stringify(gradingSchemasOut));
  writeFileSync(resolve(OUT_DIR, 'grading_categories.json'), JSON.stringify(gradingCategoriesOut));
  const defaultGradingCategoryId = gradingCategoriesOut[0].id as string;

  // 13) assignments (courseId -> group_subject_id already set above)
  const assignments = tareas.map((t) => {
    const courseId = String(t.cursoId || t.courseId);
    const groupSubjectId = courseIdToGroupSubjectId.get(courseId) || toUUID(`gs-${courseId}`);
    return {
      id: toUUID(String(t._id)),
      group_subject_id: groupSubjectId,
      title: (t.titulo as string) || '',
      description: (t.descripcion as string) || '',
      content_document: (t.contenidoDocumento as string) || null,
      due_date: (t.fechaEntrega as string) || now.toISOString(),
      max_score: (t.maxScore as number) ?? 100,
      assignment_category_id: t.categoryId ? toUUID(String(t.categoryId)) : defaultAssignmentCategoryId,
      created_by: toUUID(String(t.profesorId)),
      type: (t.type as string) || 'assignment',
      is_gradable: t.isGradable !== false,
      created_at: (t.createdAt as string) || now.toISOString(),
    };
  });
  writeFileSync(resolve(OUT_DIR, 'assignments.json'), JSON.stringify(assignments));

  // 14) submissions from tareas.submissions
  const submissions: Record[] = [];
  for (const t of tareas) {
    const assignmentId = toUUID(String(t._id));
    const subs = (t.submissions as Record[] | undefined) || [];
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      const studentId = toUUID(String(s.estudianteId));
      submissions.push({
        id: uuidV5(`${assignmentId}-${studentId}-${i}`, NAMESPACE),
        assignment_id: assignmentId,
        student_id: studentId,
        score: s.calificacion ?? null,
        feedback: (s.retroalimentacion as string) || null,
        status: s.calificacion != null ? 'graded' : 'submitted',
        late: false,
        missing: false,
        excused: false,
        submitted_at: (s.fechaEntrega as string) || now.toISOString(),
        attachments: s.archivos ?? [],
        created_at: (s.fechaEntrega as string) || now.toISOString(),
        updated_at: now.toISOString(),
      });
    }
  }
  writeFileSync(resolve(OUT_DIR, 'submissions.json'), JSON.stringify(submissions));

  // 15) grade_events (from grade_events + from notas)
  const gradeEventsOut: Record[] = gradeEvents.map((g) => ({
    id: toUUID(String(g._id)),
    assignment_id: toUUID(String(g.assignmentId)),
    user_id: toUUID(String(g.studentId)),
    group_id: toUUID(String(g.courseId)),
    grading_category_id: toUUID(String(g.categoryId)),
    institution_id: colegioIdToInstitutionId[String(g.colegioId)] || defaultInstId,
    score: g.score as number,
    max_score: g.maxScore as number,
    normalized_score: (g.normalizedScore as number) ?? null,
    recorded_at: (g.recordedAt as string) || now.toISOString(),
    recorded_by_id: toUUID(String(g.recordedBy)),
  }));
  const assignmentIdToCourseId = new Map<string, string>();
  for (const t of tareas) {
    assignmentIdToCourseId.set(toUUID(String(t._id)), String(t.cursoId || t.courseId));
  }
  for (const n of notas) {
    const assignmentId = toUUID(String(n.tareaId));
    const courseId = assignmentIdToCourseId.get(assignmentId);
    const groupId = courseId ? (courseIdToGroupId[courseId] || toUUID(courseId)) : defaultInstId;
    const gradingCategoryId = defaultGradingCategoryId;
    if (!gradingCategoryId) continue;
    gradeEventsOut.push({
      id: uuidV5(`ge-${n._id}-${n.estudianteId}`, NAMESPACE),
      assignment_id: assignmentId,
      user_id: toUUID(String(n.estudianteId)),
      group_id: groupId,
      grading_category_id: gradingCategoryId,
      institution_id: defaultInstId,
      score: (n.nota as number) ?? 0,
      max_score: 100,
      normalized_score: (n.nota as number) ?? null,
      recorded_at: (n.fecha as string) || now.toISOString(),
      recorded_by_id: toUUID(String(n.profesorId)),
    });
  }
  writeFileSync(resolve(OUT_DIR, 'grade_events.json'), JSON.stringify(gradeEventsOut));

  // 16) grades (one per assignment+user from grade_events or notas)
  const grades: Record[] = [];
  const seenGrade = new Set<string>();
  for (const g of gradeEventsOut) {
    const key = `${g.assignment_id}-${g.user_id}`;
    if (seenGrade.has(key)) continue;
    seenGrade.add(key);
    grades.push({
      id: uuidV5(`grade-${key}`, NAMESPACE),
      assignment_id: g.assignment_id,
      user_id: g.user_id,
      group_id: g.group_id,
      grading_category_id: g.grading_category_id,
      score: g.score,
      max_score: g.max_score,
      normalized_score: g.normalized_score,
      recorded_at: g.recorded_at,
      recorded_by_id: g.recorded_by_id,
    });
  }
  writeFileSync(resolve(OUT_DIR, 'grades.json'), JSON.stringify(grades));

  // 17) attendance (cursoId -> group_subject_id; asistencias have cursoId)
  const attendance = asistencias.map((a) => {
    const courseId = String(a.cursoId);
    const groupSubjectId = courseIdToGroupSubjectId.get(courseId) || toUUID(`gs-${courseId}`);
    return {
      id: uuidV5(`att-${a._id}`, NAMESPACE),
      institution_id: colegioIdToInstitutionId[String(a.colegioId)] || defaultInstId,
      group_subject_id: groupSubjectId,
      user_id: toUUID(String(a.estudianteId)),
      date: (a.fecha as string)?.slice?.(0, 10) || new Date().toISOString().slice(0, 10),
      period_slot: (a.horaBloque as string) || null,
      status: (a.estado as string) === 'presente' ? 'present' : 'absent',
      punctuality: (a.puntualidad as string) || null,
      recorded_by_id: a.recordedBy ? toUUID(String(a.recordedBy)) : null,
      created_at: now.toISOString(),
    };
  });
  writeFileSync(resolve(OUT_DIR, 'attendance.json'), JSON.stringify(attendance));

  // 18) guardian_students (vinculaciones)
  const guardianStudents = vinculaciones.map((v) => ({
    guardian_id: toUUID(String(v.padreId)),
    student_id: toUUID(String(v.estudianteId)),
    institution_id: colegioIdToInstitutionId[String(v.colegioId)] || defaultInstId,
    created_at: (v.createdAt as string) || now.toISOString(),
  }));
  writeFileSync(resolve(OUT_DIR, 'guardian_students.json'), JSON.stringify(guardianStudents));

  // 19) conversations, messages, notifications, events, chat_sessions, chat_messages, announcements, announcement_messages
  const conversationsOut = conversaciones.map((c) => ({
    id: toUUID(String(c._id)),
    institution_id: colegioIdToInstitutionId[String(c.colegioId)] || defaultInstId,
    subject: (c.asunto as string) || '',
    type: (c.tipo as string) || 'colegio-padre',
    created_by: toUUID(String(c.creadoPor)),
    created_at: (c.createdAt as string) || now.toISOString(),
  }));
  writeFileSync(resolve(OUT_DIR, 'conversations.json'), JSON.stringify(conversationsOut));

  const messagesOut = mensajes.map((m) => ({
    id: toUUID(String((m as Record & { _id: string })._id)) || uuidV5(`msg-${m.conversationId}-${m.fecha}`, NAMESPACE),
    conversation_id: m.conversationId ? toUUID(String(m.conversationId)) : null,
    sender_id: toUUID(String(m.remitenteId)),
    text: (m.texto as string) || '',
    attachments: (m.adjuntos as string[]) || [],
    read_at: (m as Record).leido ? now.toISOString() : null,
    created_at: (m.fecha as string) || now.toISOString(),
  })).filter((m) => m.conversation_id);
  writeFileSync(resolve(OUT_DIR, 'messages.json'), JSON.stringify(messagesOut));

  const notificationsOut = notificaciones.map((n) => ({
    id: toUUID(String((n as Record & { _id: string })._id)),
    institution_id: defaultInstId,
    user_id: toUUID(String(n.usuarioId)),
    title: (n.titulo as string) || '',
    body: (n.descripcion as string) || '',
    read_at: (n as Record).leido ? now.toISOString() : null,
    created_at: (n.fecha as string) || now.toISOString(),
  }));
  writeFileSync(resolve(OUT_DIR, 'notifications.json'), JSON.stringify(notificationsOut));

  const eventsOut = eventos.map((e) => ({
    id: toUUID(String((e as Record & { _id: string })._id)),
    institution_id: colegioIdToInstitutionId[String(e.colegioId)] || defaultInstId,
    title: (e.titulo as string) || '',
    description: (e.descripcion as string) || null,
    date: (e.fecha as string) || now.toISOString(),
    type: (e.tipo as string) || 'colegio',
    group_id: e.cursoId ? courseIdToGroupId[String(e.cursoId)] || null : null,
    created_by_id: e.creadoPor ? toUUID(String(e.creadoPor)) : null,
    created_at: now.toISOString(),
  }));
  writeFileSync(resolve(OUT_DIR, 'events.json'), JSON.stringify(eventsOut));

  const chatSessionsOut = chats.map((c) => ({
    id: toUUID(String((c as Record & { _id: string })._id)),
    institution_id: colegioIdToInstitutionId[String(c.colegioId)] || defaultInstId,
    title: (c.titulo as string) || null,
    created_by_id: c.userId ? toUUID(String(c.userId)) : null,
    group_id: c.cursoId ? courseIdToGroupId[String(c.cursoId)] || null : null,
    created_at: (c.createdAt as string) || now.toISOString(),
    updated_at: (c.updatedAt as string) || now.toISOString(),
  }));
  writeFileSync(resolve(OUT_DIR, 'chat_sessions.json'), JSON.stringify(chatSessionsOut));

  const chatMessagesOut = chatMessages.map((m) => ({
    id: toUUID(String((m as Record & { _id: string })._id)),
    chat_session_id: toUUID(String(m.chatId)),
    user_id: null as string | null,
    role: (m.role as string) || 'user',
    content: (m.content as string) || '',
    type: (m.type as string) || 'text',
    structured_data: (m.structuredData as Record) || null,
    created_at: (m.createdAt as string) || now.toISOString(),
  }));
  writeFileSync(resolve(OUT_DIR, 'chat_messages.json'), JSON.stringify(chatMessagesOut));

  const announcementsOut = evoThreads.map((t) => ({
    id: toUUID(String((t as Record & { _id: string })._id)),
    institution_id: colegioIdToInstitutionId[String(t.colegioId)] || defaultInstId,
    title: (t.asunto as string) || '',
    body: null as string | null,
    type: (t.tipo as string) || 'general',
    group_id: t.cursoId ? courseIdToGroupId[String(t.cursoId)] || null : null,
    assignment_id: t.assignmentId ? toUUID(String(t.assignmentId)) : null,
    created_by_id: toUUID(String(t.creadoPor)),
    published_at: (t.createdAt as string) || null,
    created_at: (t.createdAt as string) || now.toISOString(),
    updated_at: (t.updatedAt as string) || now.toISOString(),
  }));
  writeFileSync(resolve(OUT_DIR, 'announcements.json'), JSON.stringify(announcementsOut));

  const announcementMessagesOut = evoMessages.map((m) => ({
    id: toUUID(String((m as Record & { _id: string })._id)),
    announcement_id: toUUID(String(m.threadId)),
    sender_id: toUUID(String(m.remitenteId)),
    sender_role: (m.rolRemitente as string) || '',
    content: (m.contenido as string) || '',
    content_type: (m.tipo as string) || 'texto',
    priority: (m.prioridad as string) || 'normal',
    created_at: (m.fecha as string) || now.toISOString(),
  }));
  writeFileSync(resolve(OUT_DIR, 'announcement_messages.json'), JSON.stringify(announcementMessagesOut));

  // 20) learning_resources (materiales), assignment_materials
  const learningResources = materiales.map((m) => ({
    id: toUUID(String((m as Record & { _id: string })._id)),
    institution_id: colegioIdToInstitutionId[String(m.colegioId)] || defaultInstId,
    subject_id: m.materiaId ? toUUID(String(m.materiaId)) : null,
    group_id: m.cursoId ? courseIdToGroupId[String(m.cursoId)] || null : null,
    title: (m.titulo as string) || '',
    description: (m.descripcion as string) || null,
    type: (m.tipo as string) || 'other',
    url: (m.url as string) || null,
    content: (m.contenido as string) || null,
    uploaded_by_id: m.uploadedBy ? toUUID(String(m.uploadedBy)) : null,
    created_at: (m.createdAt as string) || now.toISOString(),
  }));
  writeFileSync(resolve(OUT_DIR, 'learning_resources.json'), JSON.stringify(learningResources));

  const assignmentMaterialsOut = assignmentMaterials.map((a) => ({
    id: toUUID(String((a as Record & { _id: string })._id)) || uuidV5(`am-${a.assignmentId}-${a.url}`, NAMESPACE),
    assignment_id: toUUID(String(a.assignmentId)),
    type: (a.type as string) || 'file',
    url: (a.url as string) || '',
    file_name: (a.fileName as string) || null,
    mime_type: (a.mimeType as string) || null,
    uploaded_at: (a.uploadedAt as string) || now.toISOString(),
  }));
  writeFileSync(resolve(OUT_DIR, 'assignment_materials.json'), JSON.stringify(assignmentMaterialsOut));

  // 21) analytics tables
  const perfSnapshots = performanceSnapshots.map((p) => ({
    id: toUUID(String(p._id)),
    institution_id: colegioIdToInstitutionId[String(p.colegioId)] || defaultInstId,
    user_id: toUUID(String(p.studentId)),
    group_id: toUUID(String(p.courseId)),
    at: (p.at as string) || now.toISOString(),
    weighted_final_average: (p.weightedFinalAverage as number) ?? 0,
    category_averages: (p.categoryAverages as Record) ?? {},
    category_impacts: (p.categoryImpacts as Record) ?? {},
    consistency_index: (p.consistencyIndex as number) ?? null,
    trend_direction: (p.trendDirection as string) || null,
  }));
  writeFileSync(resolve(OUT_DIR, 'analytics_performance_snapshots.json'), JSON.stringify(perfSnapshots));

  const perfForecasts = performanceForecasts.map((p) => ({
    id: toUUID(String(p._id)),
    institution_id: colegioIdToInstitutionId[String(p.colegioId)] || defaultInstId,
    user_id: toUUID(String(p.studentId)),
    group_id: toUUID(String(p.courseId)),
    generated_at: (p.generatedAt as string) || now.toISOString(),
    projected_final_grade: (p.projectedFinalGrade as number) ?? 0,
    confidence_low: (p.confidenceInterval as { low: number })?.low ?? 0,
    confidence_high: (p.confidenceInterval as { high: number })?.high ?? 0,
    risk_probability_percent: (p.riskProbabilityPercent as number) ?? null,
    method: (p.method as string) || null,
  }));
  writeFileSync(resolve(OUT_DIR, 'analytics_performance_forecasts.json'), JSON.stringify(perfForecasts));

  const riskOut = riskAssessments.map((r) => ({
    id: toUUID(String(r._id)),
    institution_id: colegioIdToInstitutionId[String(r.colegioId)] || defaultInstId,
    user_id: toUUID(String(r.studentId)),
    group_id: toUUID(String(r.courseId)),
    at: (r.at as string) || now.toISOString(),
    level: (r.level as string) || 'low',
    factors: (r.factors as string[]) || [],
    academic_stability_index: (r.academicStabilityIndex as number) ?? null,
    recovery_potential_score: (r.recoveryPotentialScore as number) ?? null,
  }));
  writeFileSync(resolve(OUT_DIR, 'analytics_risk_assessments.json'), JSON.stringify(riskOut));

  const aiLogsOut = aiActionLogs.map((a) => ({
    id: toUUID(String((a as Record & { _id: string })._id)),
    institution_id: colegioIdToInstitutionId[String(a.colegioId)] || defaultInstId,
    actor_user_id: toUUID(String(a.userId)),
    actor_role: (a.role as string) || '',
    action_name: (a.action as string) || '',
    entity_type: (a.entityType as string) || null,
    entity_id: a.entityId ? toUUID(String(a.entityId)) : null,
    parameters: (a.requestData as Record) ?? {},
    result: {},
    status: (a.result as string) || 'success',
    created_at: (a.timestamp as string) || now.toISOString(),
  }));
  writeFileSync(resolve(OUT_DIR, 'analytics_ai_action_logs.json'), JSON.stringify(aiLogsOut));

  // 22) group_schedules, professor_schedules
  const groupSchedulesOut = groupSchedules
    .map((gs) => {
      const grupoId = String(gs.grupoId || '');
      const groupId = groupByName.get(grupoId) || groupByName.get(grupoId.toUpperCase());
      if (!groupId) return null;
      const institutionId = colegioIdToInstitutionId[String(gs.colegioId)] || defaultInstId;
      const rawSlots = (gs.slots as Record<string, unknown>) || {};
      const slots: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawSlots)) {
        if (v != null) slots[k] = toUUID(String(v));
      }
      return {
        institution_id: institutionId,
        group_id: groupId,
        slots,
        updated_at: (gs.updatedAt as string) || now.toISOString(),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
  writeFileSync(resolve(OUT_DIR, 'group_schedules.json'), JSON.stringify(groupSchedulesOut));

  const professorSchedulesOut = professorSchedules
    .map((ps) => {
      const professorId = toUUID(String(ps.profesorId));
      if (!professorId || !userIdMap.has(professorId)) return null;
      const institutionId = colegioIdToInstitutionId[String(ps.colegioId)] || defaultInstId;
      const slots = typeof ps.slots === 'object' && ps.slots !== null ? (ps.slots as Record<string, string>) : {};
      return {
        institution_id: institutionId,
        professor_id: professorId,
        slots,
        updated_at: (ps.updatedAt as string) || now.toISOString(),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
  writeFileSync(resolve(OUT_DIR, 'professor_schedules.json'), JSON.stringify(professorSchedulesOut));

  console.log('Transform done. Output in scripts/migrate/out/');
}

run();
