import { buildConfig } from '../config/index.js';
import { closeSql } from '../db/client.js';
import { generateRepresentativeQueries } from '../services/llmEnrichment.js';
import { backfillRepresentativeQueries } from '../services/enrichmentBackfill.js';

/**
 * Generates representative queries for active entries that have none.
 *
 *   node dist/scripts/backfillRepresentativeQueries.js [--dry-run] [--prefix=<org_id prefix>]
 *
 * Needs OPENAI_API_KEY (the same key write-time enrichment uses).
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const prefix = args.find((a) => a.startsWith('--prefix='))?.slice('--prefix='.length) ?? '';
  const { llmEnrichment } = buildConfig();

  if (!llmEnrichment.apiKey) {
    console.error('OPENAI_API_KEY is not set — nothing to generate queries with.');
    process.exit(1);
  }

  try {
    const summary = await backfillRepresentativeQueries({
      generate: (input) => generateRepresentativeQueries(input, llmEnrichment),
      dryRun,
      orgIdPrefix: prefix,
    });
    console.log(`${dryRun ? '[dry run] ' : ''}checked ${summary.checked}, updated ${summary.updated}, failed ${summary.failed}`);
    if (summary.failed > 0) console.log(`failed: ${summary.failedOrgIds.join(', ')}`);
  } finally {
    await closeSql();
  }
}

main().catch((err: unknown) => {
  console.error('backfill failed:', err);
  process.exit(1);
});
