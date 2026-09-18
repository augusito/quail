import { APIError, type CollectionBeforeChangeHook } from 'payload'

import type { Contract } from '../payload-types'

/**
 * §6.4: "Contract lifecycle state machine: Draft → Sent → Signed → Active →
 * Released/Discharged... Each transition is enforced with a straightforward
 * validation check (which role may move it, and from which prior state)".
 *
 * Access control (src/access/roles.ts, wired into Contracts.ts) already
 * decides *whether a request can touch this row at all* (admin: any
 * contract; trainer: only their own). This hook is the second, narrower
 * check §6.4 asks for: *which specific transition* is being attempted, and
 * whether this role may perform exactly that step. A trainer's row-level
 * write access covers their own contract, but that doesn't mean they may
 * jump it straight to "active" or "released" — only admin may, and only
 * one step at a time.
 *
 * "A trainer can flag/request completion, but admin makes the final
 * transition" (§6.4, confirmed) is modeled as the separate
 * `releaseRequested` field, not as trainer write access to status itself.
 */

type ContractStatus = Contract['status']

const STATUS_ORDER: ContractStatus[] = ['draft', 'sent', 'signed', 'active', 'released']

// Which role(s) may perform a given single-step transition. Absence from
// this map means the transition is illegal for anyone (wrong direction, or
// skips a state) — checked before the role check below.
const TRANSITION_ROLES: Record<string, ('admin' | 'trainer')[]> = {
  'draft->sent': ['admin'],
  'sent->signed': ['admin', 'trainer'],
  'signed->active': ['admin'],
  'active->released': ['admin'],
}

export const validateContractStatusTransition: CollectionBeforeChangeHook<Contract> = ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (operation !== 'update' || !originalDoc) return data
  if (!data.status || data.status === originalDoc.status) return data

  // No req.user means a trusted system-level call (a local-API script
  // running without a user, e.g. seeding/migration) — those intentionally
  // bypass both access control and this workflow gate.
  if (!req.user) return data

  const from = originalDoc.status
  const to = data.status
  const allowedRoles = TRANSITION_ROLES[`${from}->${to}`]

  if (!allowedRoles) {
    const fromIndex = STATUS_ORDER.indexOf(from)
    const toIndex = STATUS_ORDER.indexOf(to)
    const reason =
      toIndex < fromIndex
        ? 'contracts cannot move backward'
        : 'contracts must progress one step at a time (Draft → Sent → Signed → Active → Released/Discharged)'
    throw new APIError(`Cannot move this contract from "${from}" to "${to}" — ${reason}.`, 400, undefined, true)
  }

  if (!allowedRoles.includes(req.user.role as (typeof allowedRoles)[number])) {
    throw new APIError(
      `Only ${allowedRoles.join(' or ')} may move a contract from "${from}" to "${to}".`,
      403,
      undefined,
      true,
    )
  }

  return data
}
