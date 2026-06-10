/** Share URL for a plan doc — hash route, so it works on GitHub Pages. */
export const sharedPlanUrl = (id: string) =>
  `${location.origin}${location.pathname}#/shared/${id}`
