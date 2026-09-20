import type { CollectionSlug, Endpoint, Where } from 'payload'

import { buildWorkbookBuffer } from '../exports/buildWorkbook'
import { exportRegistry } from '../exports/registry'

// §6.11 "Confirmed export destination for v1: a straight Excel download."
// §4 "Bulk export": Admin only. GET /api/export/:collection — the
// collection admin-only check happens here explicitly (not just via each
// collection's own access config) because this reads with
// overrideAccess: true to get the full picture for a report, bypassing
// row-level scoping like "trainer sees only their own contracts" that
// would otherwise make the export incomplete.
//
// Optional ?cohort=<id> narrows to that cohort, for collections that carry
// a cohort field — e.g. exporting one cohort's roster before closing it
// (§6.1's closing checklist).
const COHORT_FILTERABLE: CollectionSlug[] = [
  'enrollments',
  'contracts',
  'training-sessions',
  'logbook-entries',
  'evaluations',
]

export const exportCollectionEndpoint: Endpoint = {
  path: '/export/:collection',
  method: 'get',
  handler: async (req) => {
    if (req.user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const collection = req.routeParams?.collection as CollectionSlug | undefined
    const definition = collection ? exportRegistry[collection] : undefined
    if (!collection || !definition) {
      return Response.json(
        { error: `Unknown or non-exportable collection. Available: ${Object.keys(exportRegistry).join(', ')}` },
        { status: 404 },
      )
    }

    const cohortId = req.query?.cohort
    const where: Where | undefined =
      typeof cohortId === 'string' && COHORT_FILTERABLE.includes(collection)
        ? { cohort: { equals: cohortId } }
        : undefined

    const { docs } = await req.payload.find({
      collection,
      where,
      limit: 0,
      depth: 1,
      overrideAccess: true,
    })

    const buffer = await buildWorkbookBuffer(definition.label, definition.columns, docs)
    const filename = `${collection}-export-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  },
}
