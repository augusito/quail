import { APIError, type CollectionBeforeLoginHook } from 'payload'

import type { User } from '../payload-types'

/**
 * §6.2: "Registration is not immediate: after self-registering, the
 * account sits in a pending-approval state until admin reviews and
 * approves it." That's only meaningful if a pending (or deactivated)
 * account genuinely can't use the system yet — Payload's local-auth
 * login has no built-in concept of our custom `status` field, so without
 * this hook a freshly self-registered account could log in immediately,
 * before any admin ever looked at it.
 */
export const restrictPendingLogin: CollectionBeforeLoginHook<User> = ({ user }) => {
  if (user.status === 'pending') {
    throw new APIError(
      'Your account is pending admin approval. You will be able to log in once it has been reviewed.',
      403,
      undefined,
      true,
    )
  }
  if (user.status === 'inactive') {
    throw new APIError('This account has been deactivated.', 403, undefined, true)
  }
  return user
}
