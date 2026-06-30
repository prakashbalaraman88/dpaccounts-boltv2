/**
 * annotateProjects — pure function that stamps a `locked` flag onto each project.
 *
 * The array must already be sorted most-recent-first (same order that
 * loadProjects uses after its activity sort).  Projects at index >= limit are
 * locked; projects within the limit are not.
 *
 * When a server lock-map is available (lockMap has at least one entry) it takes
 * precedence over the index-based calculation — this mirrors the behaviour in
 * loadProjects exactly so the tests exercise the same branch that runs in
 * production after the Supabase RPC is available.
 *
 * @param {Array<{id: string|number, [key: string]: any}>} sortedProjects
 *   Projects sorted by recency, most-recent first.
 * @param {number} limit
 *   Maximum number of unlocked projects allowed for the current plan
 *   (use Infinity for the Unlimited plan).
 * @param {Object<string|number, boolean>} [lockMap={}]
 *   Server-authoritative lock map keyed by project id.  Pass an empty object
 *   (or omit) to use the client-side index-based fallback.
 * @returns {Array<{locked: boolean, [key: string]: any}>}
 */
function annotateProjects(sortedProjects, limit, lockMap) {
  if (lockMap === undefined) lockMap = {};
  var useFallback = Object.keys(lockMap).length === 0;
  return sortedProjects.map(function (p, i) {
    return Object.assign({}, p, {
      locked: useFallback
        ? limit !== Infinity && i >= limit
        : (lockMap[p.id] !== undefined ? lockMap[p.id] : false),
    });
  });
}

module.exports = { annotateProjects };
