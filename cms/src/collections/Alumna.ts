import type { Access, AccessResult, CollectionConfig, Where } from 'payload'

import { adminOrRoleOwnsField, adminOrRoleOwnsFieldOnCreate, hasRole, isAdmin } from '../access/roles'
import { getGraduatedInternIds } from '../access/scoping'

const readAccess: Access = async ({ req: { user, payload } }): Promise<AccessResult> => {
  if (hasRole(user, 'admin')) return true
  const graduatedInternIds = await getGraduatedInternIds(payload)
  const publicListing: Where = { and: [{ optedIn: { equals: true } }, { intern: { in: graduatedInternIds } }] }
  if (hasRole(user, 'intern')) {
    // Alumni Hub access covers viewing/editing your own profile
    // regardless of graduated/resigned outcome; the graduated-only filter
    // only applies to *other* people's profiles (the public listing).
    return { or: [{ intern: { equals: user!.id } }, publicListing] }
  }
  // Public and any other role: the actual public Talent Board view.
  return publicListing
}

// Talent Board + Alumni Hub. Talent Board eligibility is limited to
// actual graduates (not resigned/non-completing alumni) — enforced via
// getGraduatedInternIds cross-checking the linked intern's
// Enrollment.outcome before surfacing optedIn profiles publicly.
// Employers contact admin as intermediary; this is not a messaging surface.
//
// "View talent board" — Admin (all), Public (view-only). "Edit own talent
// board listing" — Admin, Intern (own, post-graduation opt-in).
//
// Renamed from `AlumniProfile` to `Alumna`. `intern` still relates to
// `users` (not the new `Intern` profile collection) — this is about which
// login account the listing belongs to, not the intern's
// statutory/registration profile data, and keeping it on `users` avoids
// ever nesting the sensitive Intern fields into a publicly-readable
// relationship.
export const Alumna: CollectionConfig = {
  slug: 'alumnae',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'intern', 'optedIn'],
  },
  access: {
    create: adminOrRoleOwnsFieldOnCreate('intern', 'intern'),
    read: readAccess,
    update: adminOrRoleOwnsField('intern', 'intern'),
    delete: isAdmin,
  },
  fields: [
    {
      name: 'intern',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description:
          'The public Talent Board display name — separate from Users.name, since the intern\'s account isn\'t publicly readable.',
      },
    },
    {
      name: 'photo',
      type: 'relationship',
      relationTo: 'images',
    },
    {
      name: 'employmentStatus',
      type: 'text',
    },
    {
      name: 'courses',
      type: 'array',
      admin: {
        description: 'Driving class certifications, defensive driving certification, diploma/course names and issuing institutions.',
      },
      fields: [{ name: 'name', type: 'text', required: true }],
    },
    {
      name: 'workExperience',
      type: 'array',
      fields: [{ name: 'description', type: 'text', required: true }],
    },
    {
      name: 'bio',
      type: 'textarea',
      admin: {
        description: 'Narrative skills/ability summary: soft skills, technical skills gained, notable achievements.',
      },
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'optedIn',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Opt-in step at graduation for appearing on the public Talent Board; self-service, can be withdrawn at any time.',
      },
    },
  ],
}
