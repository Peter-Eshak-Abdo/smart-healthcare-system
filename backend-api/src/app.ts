import express, { type Express } from 'express';
import { createAppDeps, type AppDeps } from './app-deps.js';
import type { AppEnv } from './config/env.js';
import { authenticateMiddleware } from './middleware/authenticate.js';
import { clientVersionMiddleware } from './middleware/client-version.js';
import { errorHandlerMiddleware, notFoundMiddleware } from './middleware/error-handler.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import {
  corsMiddleware,
  httpLoggerMiddleware,
  securityHeadersMiddleware,
} from './middleware/security-headers.js';
import { accessRoutes } from './modules/access/routes.js';
import { adminRoutes } from './modules/admin/routes.js';
import { assistantRoutes } from './modules/assistant/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { biometricRoutes, type BiometricAnalyzerPort } from './modules/biometrics/routes.js';
import { doctorRoutes } from './modules/doctor/routes.js';
import { emergencyRoutes } from './modules/emergency/routes.js';
import { meRoutes } from './modules/me/routes.js';
import { patientRoutes } from './modules/patients/routes.js';
import { pharmacyRoutes } from './modules/pharmacy/routes.js';
import { prescriptionRoutes } from './modules/prescriptions/routes.js';
import { refRoutes } from './modules/ref/routes.js';
import { systemRoutes } from './modules/system/routes.js';

export interface BuildAppOptions {
  deps?: AppDeps;
  biometricAnalyzer?: BiometricAnalyzerPort;
}

export function buildApp(env: AppEnv, opts: BuildAppOptions = {}): Express {
  const deps = opts.deps ?? createAppDeps(env);
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Fast root health endpoint for Render.com port-scan & platform health checks
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      version: env.APP_VERSION,
      commit: env.GIT_COMMIT,
    });
  });

  // 1. Request ID + AsyncLocalStorage context
  app.use(requestIdMiddleware());
  // 2. Structured HTTP request logging with PHI redaction
  app.use(httpLoggerMiddleware(deps.logger));
  // 3. Helmet + HSTS + no-store + CORS allowlist
  app.use(...securityHeadersMiddleware());
  app.use(corsMiddleware(deps.env));
  // 4. JSON body limit (1 MB)
  app.use(express.json({ limit: '1mb', strict: true }));

  // Public system routes (liveness, readiness, JWKS, mobile config) before version/auth gates
  app.use('/v1', systemRoutes(deps));

  // 5. Client minimum version enforcement (426 Upgrade Required)
  app.use(clientVersionMiddleware(deps.env));

  // 6. Auth IP rate limit bucket
  app.use('/v1/auth', deps.rateLimit.middleware('auth_ip', (req) => req.ip ?? 'unknown'));

  // 7. Authentication -> AuthContext validation
  app.use('/v1', authenticateMiddleware(deps.verifyJwt, deps.authContext));

  // 8. Global per-user rate limiter
  app.use('/v1', deps.rateLimit.middleware('global_user'));

  // 9. Stage 2 & Stage 4 Authenticated Domain Modules (Firestore + Firebase Auth)
  app.use(
    '/v1',
    authRoutes(deps),
    meRoutes(deps),
    patientRoutes(deps),
    biometricRoutes(deps, opts.biometricAnalyzer),
    accessRoutes(deps),
    doctorRoutes(deps),
    refRoutes(deps),
    prescriptionRoutes(deps),
    pharmacyRoutes(deps),
    emergencyRoutes(deps),
    assistantRoutes(deps),
    adminRoutes(deps),
  );

  // 10-11. 404 + RFC 9457 Problem Details error handler
  app.use(notFoundMiddleware());
  app.use(errorHandlerMiddleware(deps.logger, deps.db));

  return app;
}
