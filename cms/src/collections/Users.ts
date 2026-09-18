import type { CollectionConfig } from 'payload'

// Roles per proposal §4. Program Director/Consultant/Coordinator job titles
// all map to the Admin role — no separate tier for them. "Public" is not a
// user role; it describes unauthenticated access to the Talent Board (§6.9).
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'status'],
  },
  auth: true,
  fields: [
    // Email added by default
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'intern',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Trainer', value: 'trainer' },
        { label: 'Intern', value: 'intern' },
        { label: 'Supervisor', value: 'supervisor' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
    },
    {
      name: 'phone',
      type: 'text',
    },
  ],
}
