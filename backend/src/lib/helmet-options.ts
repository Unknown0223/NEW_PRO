import type { FastifyHelmetOptions } from "@fastify/helmet";

/**
 * Conservative CSP for API responses. Next.js inline scripts are served from the
 * frontend origin, not the API — API CSP mainly blocks embedding and XSS vectors.
 */
export const helmetOptions: FastifyHelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
};
