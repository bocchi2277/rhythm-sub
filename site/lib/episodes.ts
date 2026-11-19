/**
 * Canonical episode ordering — re-exported from the shared boundary contract
 * (shared/rules.mjs), the SINGLE source of truth also imported by the scraper
 * (scraper/src/build-model.mjs). /schedule and /anime/<slug> can no longer
 * disagree about what "latest" means.
 *
 * Pure re-export (no runtime imports of its own) so Node's type stripping can
 * load it directly for the parity test.
 */
export { compareEpisodesDesc } from '../../shared/rules.mjs';
