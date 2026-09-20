// Populates a fresh dev DB with realistic sample data for local
// exploration/demos: one of every role, three cohorts in different stages
// (closed/active/open), and enough related records — enrollments,
// contracts, documents, scores, evaluations, logbooks, alumni profiles,
// invites, announcements, cohort media — to click through the admin panel
// and the public Talent Board and see something that isn't empty.
//
// Usage: npm run seed          (refuses to run if already seeded)
//        npm run seed -- --reset   (wipes prior seed data first, then reseeds)
import 'dotenv/config'

import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'

import config from '../src/payload.config'
import type { Module, User } from '../src/payload-types'

const DEMO_PASSWORD = 'SheDelivers2026!'
const ADMIN_EMAIL = 'admin@shedelivers.dev'
const DOMAIN = '@shedelivers.dev'

const SEEDED_COLLECTIONS = [
  'media-assets',
  'announcements',
  'invites',
  'alumni-profiles',
  'logbook-entries',
  'workplans',
  'evaluations',
  'scores',
  'documents',
  'contracts',
  'module-notes',
  'training-sessions',
  'modules',
  'enrollments',
  'cohorts',
  'files',
  'media',
  'users',
] as const

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString()
}

let uploadCounter = 0

async function dummyImage(name: string) {
  uploadCounter += 1
  const pngBuffer = await sharp({
    create: { width: 2, height: 2, channels: 4, background: { r: 90, g: 60, b: 200, alpha: 1 } },
  })
    .png()
    .toBuffer()
  return { data: pngBuffer, mimetype: 'image/png', name: `${name}-${uploadCounter}.png`, size: pngBuffer.length }
}

async function uploadFile(payload: Payload, name: string, uploadedBy: number) {
  return payload.create({
    collection: 'files',
    data: { uploadedBy },
    file: await dummyImage(name),
    overrideAccess: true,
  })
}

async function wipeSeedData(payload: Payload) {
  console.log('--reset: wiping existing seed data...')
  for (const collection of SEEDED_COLLECTIONS) {
    await payload.delete({ collection, where: {}, overrideAccess: true })
  }
}

async function alreadySeeded(payload: Payload): Promise<boolean> {
  const { totalDocs } = await payload.find({
    collection: 'users',
    where: { email: { equals: ADMIN_EMAIL } },
    limit: 1,
    overrideAccess: true,
  })
  return totalDocs > 0
}

async function seed(payload: Payload) {
  // ---- Users ---------------------------------------------------------
  console.log('Seeding users...')
  const admin = await payload.create({
    collection: 'users',
    data: { email: ADMIN_EMAIL, password: DEMO_PASSWORD, name: 'Admin User', role: 'admin', status: 'active' },
    overrideAccess: true,
  })

  const [trainerIct, trainerDriving, trainerBiz] = await Promise.all([
    payload.create({
      collection: 'users',
      data: { email: `amina.yusuf${DOMAIN}`, password: DEMO_PASSWORD, name: 'Amina Yusuf', role: 'trainer', status: 'active' },
      overrideAccess: true,
    }),
    payload.create({
      collection: 'users',
      data: { email: `peter.otieno${DOMAIN}`, password: DEMO_PASSWORD, name: 'Peter Otieno', role: 'trainer', status: 'active' },
      overrideAccess: true,
    }),
    payload.create({
      collection: 'users',
      data: { email: `grace.wanjiru${DOMAIN}`, password: DEMO_PASSWORD, name: 'Grace Wanjiru', role: 'trainer', status: 'active' },
      overrideAccess: true,
    }),
  ])

  const [supervisor1, supervisor2] = await Promise.all([
    payload.create({
      collection: 'users',
      data: { email: `john.mwangi${DOMAIN}`, password: DEMO_PASSWORD, name: 'John Mwangi', role: 'supervisor', status: 'active' },
      overrideAccess: true,
    }),
    payload.create({
      collection: 'users',
      data: { email: `faith.njeri${DOMAIN}`, password: DEMO_PASSWORD, name: 'Faith Njeri', role: 'supervisor', status: 'active' },
      overrideAccess: true,
    }),
  ])

  const internData = [
    { key: 'mercy', name: 'Mercy Achieng', track: 'ict' as const, outcome: 'graduated' as const },
    { key: 'brian', name: 'Brian Kiplagat', track: 'truck-driving' as const, outcome: 'graduated' as const },
    { key: 'susan', name: 'Susan Wambui', track: 'ict' as const, outcome: 'resigned' as const },
    { key: 'kevin', name: 'Kevin Otieno', track: 'truck-driving' as const, outcome: 'terminated' as const },
    { key: 'lilian', name: 'Lilian Chebet', track: 'business-management' as const, outcome: 'in-progress' as const },
    { key: 'dennis', name: 'Dennis Mutua', track: 'supply-chain' as const, outcome: 'in-progress' as const },
    { key: 'sharon', name: 'Sharon Adhiambo', track: 'business-management' as const, outcome: 'in-progress' as const },
    { key: 'josephine', name: 'Josephine Wafula', track: 'mechanics' as const, outcome: 'in-progress' as const },
    { key: 'collins', name: 'Collins Juma', track: 'ict' as const, outcome: 'in-progress' as const },
    // Still awaiting admin review, same as a fresh self-registration via
    // /api/register (§6.2) — demonstrates the approval queue.
    { key: 'faith', name: 'Faith Mumbi', track: 'ict' as const, outcome: 'in-progress' as const, pending: true },
  ]

  const interns: Record<string, User> = {}
  for (const i of internData) {
    interns[i.key] = await payload.create({
      collection: 'users',
      data: {
        email: `${i.key}${DOMAIN}`,
        password: DEMO_PASSWORD,
        name: i.name,
        role: 'intern',
        status: i.pending ? 'pending' : 'active',
      },
      overrideAccess: true,
    })
  }

  // ---- Cohorts ---------------------------------------------------------
  console.log('Seeding cohorts...')
  const cohortA = await payload.create({
    collection: 'cohorts',
    data: {
      name: '2025 Cohort A — Nairobi',
      tracks: ['ict', 'truck-driving'],
      startDate: '2025-01-06',
      endDate: '2025-06-27',
      status: 'closed',
    },
    overrideAccess: true,
  })
  const cohortB = await payload.create({
    collection: 'cohorts',
    data: {
      name: '2026 Cohort B — Mombasa',
      tracks: ['business-management', 'supply-chain'],
      startDate: '2026-02-02',
      endDate: '2026-07-24',
      status: 'active',
      // §4 "Media library access… unless granted per cohort" — Grace can
      // see this cohort's cohort-extended media, demonstrated below.
      mediaAccessGrantedTo: [trainerBiz.id],
    },
    overrideAccess: true,
  })
  const cohortC = await payload.create({
    collection: 'cohorts',
    data: {
      name: '2026 Cohort C — Kisumu',
      tracks: ['mechanics', 'ict'],
      startDate: '2026-09-28',
      endDate: '2027-03-20',
      status: 'open',
    },
    overrideAccess: true,
  })

  // ---- Modules ---------------------------------------------------------
  console.log('Seeding modules...')
  const moduleData = [
    { name: 'Web Fundamentals', track: 'ict' as const, ref: 'ICT-101' },
    { name: 'Networking Basics', track: 'ict' as const, ref: 'ICT-102' },
    { name: 'Defensive Driving', track: 'truck-driving' as const, ref: 'DRV-101' },
    { name: 'Vehicle Maintenance Basics', track: 'truck-driving' as const, ref: 'DRV-102' },
    { name: 'Business Communication', track: 'business-management' as const, ref: 'BIZ-101' },
    { name: 'Financial Literacy', track: 'business-management' as const, ref: 'BIZ-102' },
    { name: 'Logistics Fundamentals', track: 'supply-chain' as const, ref: 'SUP-101' },
    { name: 'Engine Systems', track: 'mechanics' as const, ref: 'MEC-101' },
  ]
  const modules: Record<string, Module> = {}
  for (const m of moduleData) {
    modules[m.name] = await payload.create({
      collection: 'modules',
      data: { name: m.name, track: m.track, curriculumReference: m.ref },
      overrideAccess: true,
    })
  }

  // ---- Enrollments -------------------------------------------------------
  console.log('Seeding enrollments...')
  const enrollmentPlan = [
    { intern: 'mercy', cohort: cohortA, supervisor: supervisor1 },
    { intern: 'brian', cohort: cohortA, supervisor: supervisor2 },
    { intern: 'susan', cohort: cohortA, supervisor: supervisor1 },
    { intern: 'kevin', cohort: cohortA, supervisor: supervisor2 },
    { intern: 'lilian', cohort: cohortB, supervisor: supervisor1 },
    { intern: 'dennis', cohort: cohortB, supervisor: supervisor2 },
    { intern: 'sharon', cohort: cohortB, supervisor: supervisor1 },
    { intern: 'josephine', cohort: cohortC, supervisor: supervisor2 },
    { intern: 'collins', cohort: cohortC, supervisor: supervisor1 },
    { intern: 'faith', cohort: cohortC, supervisor: supervisor2 },
  ]
  for (const e of enrollmentPlan) {
    const i = internData.find((d) => d.key === e.intern)!
    await payload.create({
      collection: 'enrollments',
      data: {
        intern: interns[e.intern].id,
        cohort: e.cohort.id,
        supervisor: e.supervisor.id,
        track: i.track,
        outcome: i.outcome,
      },
      overrideAccess: true,
    })
  }

  // ---- Training sessions -------------------------------------------------
  console.log('Seeding training sessions...')
  const sessionWebFundamentals = await payload.create({
    collection: 'training-sessions',
    data: {
      module: modules['Web Fundamentals'].id,
      trainer: trainerIct.id,
      cohort: cohortA.id,
      scheduledDate: '2025-02-10T09:00:00.000Z',
      status: 'completed',
    },
    overrideAccess: true,
  })
  const sessionDefensiveDriving = await payload.create({
    collection: 'training-sessions',
    data: {
      module: modules['Defensive Driving'].id,
      trainer: trainerDriving.id,
      cohort: cohortA.id,
      scheduledDate: '2025-02-15T09:00:00.000Z',
      status: 'completed',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'training-sessions',
    data: {
      module: modules['Business Communication'].id,
      trainer: trainerBiz.id,
      cohort: cohortB.id,
      scheduledDate: daysFromNow(14),
      status: 'scheduled',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'training-sessions',
    data: {
      module: modules['Logistics Fundamentals'].id,
      trainer: trainerBiz.id,
      cohort: cohortB.id,
      scheduledDate: daysFromNow(21),
      status: 'scheduled',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'training-sessions',
    data: {
      module: modules['Engine Systems'].id,
      trainer: trainerDriving.id,
      cohort: cohortC.id,
      scheduledDate: daysFromNow(9),
      status: 'scheduled',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'training-sessions',
    data: {
      module: modules['Networking Basics'].id,
      trainer: trainerIct.id,
      cohort: cohortC.id,
      scheduledDate: daysFromNow(16),
      status: 'scheduled',
    },
    overrideAccess: true,
  })

  // ---- Module notes (with one real slide-deck upload) --------------------
  console.log('Seeding module notes...')
  const slideDeck = await uploadFile(payload, 'web-fundamentals-slides', admin.id)
  await payload.create({
    collection: 'module-notes',
    data: {
      session: sessionWebFundamentals.id,
      trainer: trainerIct.id,
      content: 'Covered HTML/CSS basics, the DOM, and a guided exercise building a static portfolio page.',
      slideDeck: slideDeck.id,
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'module-notes',
    data: {
      session: sessionDefensiveDriving.id,
      trainer: trainerDriving.id,
      content: 'Classroom session on hazard perception and following distance, plus a supervised yard exercise.',
    },
    overrideAccess: true,
  })

  // ---- Contracts -----------------------------------------------------
  console.log('Seeding contracts...')
  const contractFileA1 = await uploadFile(payload, 'contract-ict-cohortA', admin.id)
  const contractFileA2 = await uploadFile(payload, 'contract-driving-cohortA', admin.id)
  const contractFileB1 = await uploadFile(payload, 'contract-ict-cohortB', admin.id)
  const contractFileB2 = await uploadFile(payload, 'contract-biz-cohortB', admin.id)
  await payload.create({
    collection: 'contracts',
    data: {
      trainer: trainerIct.id,
      cohort: cohortA.id,
      status: 'released',
      file: contractFileA1.id,
      ratePerSession: 4500,
      mediaConsent: true,
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'contracts',
    data: {
      trainer: trainerDriving.id,
      cohort: cohortA.id,
      status: 'released',
      file: contractFileA2.id,
      ratePerSession: 5000,
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'contracts',
    data: {
      trainer: trainerIct.id,
      cohort: cohortB.id,
      status: 'active',
      file: contractFileB1.id,
      ratePerSession: 4500,
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'contracts',
    data: {
      trainer: trainerBiz.id,
      cohort: cohortB.id,
      status: 'active',
      file: contractFileB2.id,
      ratePerSession: 4800,
      mediaConsent: true,
      releaseRequested: true, // flagged completion; admin hasn't released it yet
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'contracts',
    data: { trainer: trainerDriving.id, cohort: cohortC.id, status: 'sent', ratePerSession: 5000 },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'contracts',
    data: { trainer: trainerIct.id, cohort: cohortC.id, status: 'draft', ratePerSession: 4500 },
    overrideAccess: true,
  })

  // ---- Documents (statutory document vault, §6.7) -------------------------
  console.log('Seeding documents (uploading dummy files — this is the slow part)...')
  const docTypeByTrack: Record<string, 'driving-licence' | 'kra-pin'> = {
    'truck-driving': 'driving-licence',
    mechanics: 'driving-licence',
    ict: 'kra-pin',
    'supply-chain': 'kra-pin',
    'business-management': 'kra-pin',
  }
  // Cohort A already closed — every document is verified (the closing
  // checklist requires it). Cohort B/C interns are still mid-review: a mix
  // of pending, verified, and one rejected-with-reason.
  const documentStatus: Record<string, 'pending' | 'verified' | 'rejected'> = {
    mercy: 'verified',
    brian: 'verified',
    susan: 'verified',
    kevin: 'verified',
    lilian: 'verified',
    dennis: 'pending',
    sharon: 'rejected',
    josephine: 'pending',
    collins: 'verified',
  }
  for (const i of internData) {
    if (i.pending) continue // Faith hasn't submitted documents yet.
    const status = documentStatus[i.key]
    const nationalId = await uploadFile(payload, `${i.key}-national-id`, interns[i.key].id)
    await payload.create({
      collection: 'documents',
      data: {
        intern: interns[i.key].id,
        type: 'national-id',
        file: nationalId.id,
        verificationStatus: status,
        rejectionReason: status === 'rejected' ? 'Photo is blurry — please re-upload a clearer scan.' : undefined,
      },
      overrideAccess: true,
    })
    const secondType = docTypeByTrack[i.track]
    const secondFile = await uploadFile(payload, `${i.key}-${secondType}`, interns[i.key].id)
    await payload.create({
      collection: 'documents',
      data: {
        intern: interns[i.key].id,
        type: secondType,
        file: secondFile.id,
        verificationStatus: status,
        rejectionReason: status === 'rejected' ? 'Document is expired — please upload a current one.' : undefined,
      },
      overrideAccess: true,
    })
  }

  // ---- Scores (§6.5) -----------------------------------------------------
  console.log('Seeding scores...')
  await payload.create({
    collection: 'scores',
    data: { intern: interns.mercy.id, module: modules['Web Fundamentals'].id, value: 88, finalized: true },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'scores',
    data: { intern: interns.susan.id, module: modules['Web Fundamentals'].id, value: 74, finalized: true },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'scores',
    data: { intern: interns.brian.id, module: modules['Defensive Driving'].id, value: 91, finalized: true },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'scores',
    data: { intern: interns.kevin.id, module: modules['Defensive Driving'].id, value: 65, finalized: true },
    overrideAccess: true,
  })
  // Not yet visible to the intern — demonstrates the finalized gate (§6.5).
  await payload.create({
    collection: 'scores',
    data: {
      intern: interns.lilian.id,
      module: modules['Business Communication'].id,
      value: 80,
      notes: 'Draft — pending trainer review before release.',
      finalized: false,
    },
    overrideAccess: true,
  })

  // ---- Evaluations (§6.5) -------------------------------------------------
  console.log('Seeding evaluations...')
  const supervisorByIntern: Record<string, typeof supervisor1> = {
    mercy: supervisor1,
    brian: supervisor2,
    susan: supervisor1,
    kevin: supervisor2,
    lilian: supervisor1,
    dennis: supervisor2,
    sharon: supervisor1,
  }
  for (const key of ['mercy', 'brian', 'susan', 'kevin', 'lilian', 'dennis', 'sharon']) {
    const cohort = ['mercy', 'brian', 'susan', 'kevin'].includes(key) ? cohortA : cohortB
    await payload.create({
      collection: 'evaluations',
      data: {
        intern: interns[key].id,
        author: supervisorByIntern[key].id,
        cohort: cohort.id,
        type: 'standard',
        criteria: 'Punctuality, communication, technical aptitude, teamwork.',
        outcome: 'Meets expectations. Continues to show steady improvement.',
      },
      overrideAccess: true,
    })
  }
  // Driving-skills checkpoints are trainer-authored (§6.5 confirmed exception).
  await payload.create({
    collection: 'evaluations',
    data: {
      intern: interns.brian.id,
      author: trainerDriving.id,
      cohort: cohortA.id,
      type: 'driving-skills-baseline',
      outcome: 'Solid baseline control; needs work on reverse parking.',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'evaluations',
    data: {
      intern: interns.brian.id,
      author: trainerDriving.id,
      cohort: cohortA.id,
      type: 'driving-skills-final',
      outcome: 'Confident and safe across all maneuvers. Ready for the road.',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'evaluations',
    data: {
      intern: interns.kevin.id,
      author: trainerDriving.id,
      cohort: cohortA.id,
      type: 'driving-skills-baseline',
      outcome: 'Baseline only — intern was terminated before the final checkpoint.',
    },
    overrideAccess: true,
  })

  // ---- Workplans (§5) -----------------------------------------------------
  console.log('Seeding workplans...')
  for (const e of enrollmentPlan) {
    if (e.intern === 'faith') continue // hasn't been approved/assigned work yet
    await payload.create({
      collection: 'workplans',
      data: {
        supervisor: e.supervisor.id,
        intern: interns[e.intern].id,
        cohort: e.cohort.id,
        content: 'Weekly check-ins, a mid-cohort skills review, and a growth goal for the coming month.',
      },
      overrideAccess: true,
    })
  }

  // ---- Logbook entries (§6.6) ----------------------------------------------
  console.log('Seeding logbook entries...')
  await payload.create({
    collection: 'logbook-entries',
    data: {
      intern: interns.brian.id,
      cohort: cohortA.id,
      type: 'driver',
      author: 'self',
      date: '2025-03-03',
      trip: { area: 'Nairobi–Thika route', kmsDriven: 78, timeFrom: '07:00', timeTo: '11:30', activities: ['dispatch', 'offloading'], lessons: 'Practiced defensive following distance in heavy traffic.' },
      status: 'reviewed',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'logbook-entries',
    data: {
      intern: interns.brian.id,
      cohort: cohortA.id,
      type: 'driver',
      author: 'supervisor',
      date: '2025-03-07',
      supervisorRollup: { distanceDriven: 320, areaRegion: 'Nairobi metro', areasOfImprovement: 'Reduce idle time at checkpoints.' },
      supervisorComment: 'Good progress this week — steady and cautious driving.',
      status: 'reviewed',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'logbook-entries',
    data: {
      intern: interns.kevin.id,
      cohort: cohortA.id,
      type: 'driver',
      author: 'self',
      date: '2025-03-05',
      trip: { area: 'Mombasa Road', kmsDriven: 45, timeFrom: '08:00', timeTo: '10:15', activities: ['fueling', 'checkpoint'], lessons: 'First solo checkpoint stop.' },
      status: 'submitted',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'logbook-entries',
    data: {
      intern: interns.mercy.id,
      cohort: cohortA.id,
      type: 'non-driver',
      author: 'self',
      date: '2025-02-14',
      week: { startDate: '2025-02-10', endDate: '2025-02-14', projectAssigned: 'Portfolio site build', activitiesAndResources: 'HTML/CSS module exercises, MDN docs.', notes: 'Comfortable with flexbox now; still shaky on grid.' },
      status: 'reviewed',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'logbook-entries',
    data: {
      intern: interns.mercy.id,
      cohort: cohortA.id,
      type: 'non-driver',
      author: 'self',
      date: '2025-02-21',
      week: { startDate: '2025-02-17', endDate: '2025-02-21', projectAssigned: 'Portfolio site build', activitiesAndResources: 'Deployed site, added contact form.', notes: 'Shipped the portfolio site.' },
      supervisorComment: 'Great finish — clean, working site.',
      status: 'reviewed',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'logbook-entries',
    data: {
      intern: interns.lilian.id,
      cohort: cohortB.id,
      type: 'non-driver',
      author: 'self',
      date: daysFromNow(-3),
      week: { startDate: daysFromNow(-7), endDate: daysFromNow(-3), projectAssigned: 'Client communication drills', activitiesAndResources: 'Role-play exercises, email etiquette module.', notes: 'Still working on concise written follow-ups.' },
      status: 'submitted',
    },
    overrideAccess: true,
  })

  // ---- Alumni profiles / Talent Board (§6.9, §6.10) --------------------
  console.log('Seeding alumni profiles...')
  const mercyPhoto = await payload.create({
    collection: 'media',
    data: { alt: 'Mercy Achieng headshot' },
    file: await dummyImage('mercy-photo'),
    overrideAccess: true,
  })
  await payload.create({
    collection: 'alumni-profiles',
    data: {
      intern: interns.mercy.id,
      name: 'Mercy Achieng',
      photo: mercyPhoto.id,
      employmentStatus: 'Employed — Junior Web Developer at a Nairobi digital agency',
      courses: [{ name: 'Web Fundamentals Certificate' }, { name: 'Networking Basics Certificate' }],
      workExperience: [{ description: 'Built and shipped a client landing page during the program capstone.' }],
      bio: 'Detail-oriented and eager to grow into a full-stack role. Strong communicator, comfortable pairing with a team.',
      email: interns.mercy.email,
      optedIn: true,
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'alumni-profiles',
    data: {
      intern: interns.brian.id,
      name: 'Brian Kiplagat',
      employmentStatus: 'Employed — Delivery driver, regional logistics firm',
      courses: [{ name: 'Defensive Driving Certificate' }, { name: 'Vehicle Maintenance Basics Certificate' }],
      workExperience: [{ description: 'Completed 500+ supervised kilometers with zero incidents.' }],
      bio: 'Calm under pressure, strong safety record, punctual.',
      email: interns.brian.email,
      optedIn: true,
    },
    overrideAccess: true,
  })
  // Resigned, not graduated — same Alumni Hub access (§6.1), but not
  // Talent-Board-eligible, so opted out of the public listing.
  await payload.create({
    collection: 'alumni-profiles',
    data: {
      intern: interns.susan.id,
      name: 'Susan Wambui',
      bio: 'Left the program before completion for a family commitment.',
      email: interns.susan.email,
      optedIn: false,
    },
    overrideAccess: true,
  })

  // ---- Invites (§6.2) -----------------------------------------------------
  console.log('Seeding invites...')
  const inviteMechanics = await payload.create({
    collection: 'invites',
    data: { cohort: cohortC.id, track: 'mechanics', createdBy: admin.id },
    overrideAccess: true,
  })
  const inviteIct = await payload.create({
    collection: 'invites',
    data: { cohort: cohortC.id, track: 'ict', createdBy: admin.id },
    overrideAccess: true,
  })
  const revokedInvite = await payload.create({
    collection: 'invites',
    data: { cohort: cohortB.id, track: 'supply-chain', createdBy: admin.id },
    overrideAccess: true,
  })
  await payload.update({ collection: 'invites', id: revokedInvite.id, data: { revoked: true }, overrideAccess: true })
  const expiredInvite = await payload.create({
    collection: 'invites',
    data: { cohort: cohortB.id, track: 'business-management', createdBy: admin.id },
    overrideAccess: true,
  })
  await payload.update({
    collection: 'invites',
    id: expiredInvite.id,
    data: { expiresAt: daysFromNow(-1) },
    overrideAccess: true,
  })

  // ---- Announcements (Alumni Hub, §6.10) ----------------------------------
  console.log('Seeding announcements...')
  await payload.create({
    collection: 'announcements',
    data: {
      title: 'Welcome to the She Delivers Alumni Network',
      content: 'You now have access to the Alumni Hub — job leads, community updates, and the public Talent Board opt-in.',
      author: admin.id,
      publishedAt: daysFromNow(-60),
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'announcements',
    data: {
      title: 'Upcoming Employer Job Fair',
      content: 'We are hosting a job fair next month for employers looking to hire graduates directly from the Talent Board.',
      author: admin.id,
      publishedAt: daysFromNow(-14),
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'announcements',
    data: {
      title: 'Talent Board Photo Guidelines',
      content: 'Reminder: profile photos should be recent, well-lit headshots. Reach out to admin if you need help updating yours.',
      author: admin.id,
      publishedAt: daysFromNow(-2),
    },
    overrideAccess: true,
  })

  // ---- Media assets (cohort media library, §4 / §6.4) ---------------------
  console.log('Seeding media assets...')
  await payload.create({
    collection: 'media-assets',
    data: { cohort: cohortA.id, visibilityScope: 'admin-only', consentGiven: true },
    file: await dummyImage('cohortA-admin-only'),
    overrideAccess: true,
  })
  await payload.create({
    collection: 'media-assets',
    data: { cohort: cohortA.id, visibilityScope: 'cohort-extended', consentGiven: true },
    file: await dummyImage('cohortA-cohort-extended'),
    overrideAccess: true,
  })
  await payload.create({
    collection: 'media-assets',
    data: { cohort: cohortB.id, visibilityScope: 'admin-only' },
    file: await dummyImage('cohortB-admin-only'),
    overrideAccess: true,
  })
  // Grace (trainerBiz) was granted Cohort B's media library above — she can
  // see this one, demonstrating the per-cohort trainer grant end to end.
  await payload.create({
    collection: 'media-assets',
    data: { cohort: cohortB.id, visibilityScope: 'cohort-extended', consentGiven: true },
    file: await dummyImage('cohortB-cohort-extended'),
    overrideAccess: true,
  })

  // ---- Summary --------------------------------------------------------
  console.log('\nSeed complete.\n')
  console.log(`All accounts share the password: ${DEMO_PASSWORD}\n`)
  console.log('Log in at /admin as:')
  console.log(`  admin        ${ADMIN_EMAIL}`)
  console.log(`  trainer      amina.yusuf${DOMAIN}   (ICT)`)
  console.log(`  trainer      peter.otieno${DOMAIN}  (Truck Driving)`)
  console.log(`  trainer      grace.wanjiru${DOMAIN}  (Business Mgmt — granted Cohort B's media library)`)
  console.log(`  supervisor   john.mwangi${DOMAIN}`)
  console.log(`  supervisor   faith.njeri${DOMAIN}`)
  console.log(`  intern       mercy${DOMAIN}  (graduated, on the public Talent Board)`)
  console.log(`  intern       faith${DOMAIN}  (status: pending — try approving them as admin)\n`)
  console.log('Open invite links (Cohort C, unexpired):')
  console.log(`  /register?token=${inviteMechanics.token}  (mechanics)`)
  console.log(`  /register?token=${inviteIct.token}  (ict)\n`)
}

async function main() {
  const reset = process.argv.includes('--reset')

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  if (await alreadySeeded(payload)) {
    if (!reset) {
      console.log(`Already seeded (found a user with email ${ADMIN_EMAIL}).`)
      console.log('Run `npm run seed -- --reset` to wipe prior seed data and reseed.')
      process.exit(0)
    }
    await wipeSeedData(payload)
  }

  await seed(payload)
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
