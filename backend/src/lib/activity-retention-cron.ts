/**
 * @deprecated Activity purge endi `audit-retention-cron` ichida (yagona retention).
 * Moslik uchun re-export qilinadi.
 */
export {
  enableAuditRetentionCron as enableActivityRetentionCron,
  disableAuditRetentionCron as disableActivityRetentionCron
} from "./audit-retention-cron";
