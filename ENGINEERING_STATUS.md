# Engineering Status

## Dispatcher implementation progress

- Added `Dispatcher Command Center` at `/dispatcher`.
- Reused generated API hooks for trucks, jobs, requests, dashboard stats, activity, organization members, dump sites, dump-site states, and job timeline updates.
- Added realtime polling to the existing hooks for map, KPI, feed, and timeline data.
- Added collapsible desktop navigation in the application shell and a dispatcher-specific collapsible operations nav.
- Added global dispatcher search over records already loaded from generated API hooks.
- Added resizable activity feed and expandable operational timeline drawer.

## Remaining visual placeholders

- Web does not currently expose a real map provider component; the operations map is a production shell fed by live API data and ready to receive final map visual specifications.
- Material, truck type, customer, and driver filters are visible but disabled because the generated backend hooks do not expose those query params.
- Facilities are filtered by the existing dump-site state/type API; facility-by-id filtering is pending backend support.
- Global search currently searches loaded API result sets because no generated global search endpoint exists.

## Performance improvements

- Lazy-loaded the operations map into its own production bundle.
- Memoized map marker, route, search, feed, selected job, and KPI derivations.
- Used deferred search input to avoid blocking render work while typing.
- Limited rendered map/feed/search collections to bounded operational lists.
- Added polling through existing generated hooks without adding duplicate fetch code.

## Known blockers

- Final ChatGPT visual specs are still pending for colors, branding, typography, spacing, and motion.
- Real web map provider integration is not present in the current app package.
- Backend filters are missing for material, truck type, customer, driver, and facility id.
- Backend global search endpoint is missing for cross-entity server-side search.
