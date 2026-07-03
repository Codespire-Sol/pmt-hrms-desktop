import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../utils/asyncHandler';
import { hrService } from './hr.service';
import { JwtUtils } from '../../utils/jwt';

const router = Router();

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

/**
 * Middleware: Require a valid onboarding session token (issued after OTP verification).
 * The token must be passed as: Authorization: Bearer <sessionToken>
 * and its embedded inviteToken must match the :token route param.
 */
function requireOnboardingSession(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Email OTP verification required. Please verify your email before proceeding.',
      code: 'OTP_VERIFICATION_REQUIRED',
    });
    return;
  }

  const sessionToken = authHeader.slice(7);
  try {
    const payload = JwtUtils.verifyOnboardingSessionToken(sessionToken);
    if (payload.inviteToken !== req.params.token) {
      throw new Error('Token mismatch');
    }
    // Attach to request for downstream use if needed
    (req as any).onboardingEmployeeId = payload.employeeId;
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired session. Please verify your email OTP again.',
      code: 'INVALID_ONBOARDING_SESSION',
    });
  }
}

// Validate a registration token and get employee info + current status (public — no OTP needed).
// Returns tokenStatus: 'active' | 'pending_offer_letter' | 'offer_letter_sent'
// instead of throwing on already-used tokens, so the frontend can show the right screen.
router.get(
  '/register/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.getInviteTokenStatus(req.params.token);
    res.json({ success: true, data });
  })
);

// Send OTP to the employee's registered email for verification
router.post(
  '/register/:token/send-otp',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.sendOnboardingOtp(req.params.token);
    res.json({ success: true, data });
  })
);

// Verify the OTP and receive a session token for further registration steps
router.post(
  '/register/:token/verify-otp',
  asyncHandler(async (req: Request, res: Response) => {
    const { otp } = req.body as { otp?: string };
    if (!otp) {
      res.status(400).json({ success: false, message: 'OTP is required' });
      return;
    }
    const data = await hrService.verifyOnboardingOtp(req.params.token, String(otp));
    res.json({ success: true, data });
  })
);

// Submit personal details — requires OTP-verified session token
router.patch(
  '/register/:token',
  requireOnboardingSession,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.submitSelfRegistration(req.params.token, req.body);
    res.json({ success: true, data });
  })
);

// Mark onboarding submission complete (after all required docs uploaded) — requires OTP-verified session
router.post(
  '/register/:token/complete',
  requireOnboardingSession,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.markOnboardingSubmissionComplete(req.params.token);
    res.json({ success: true, data });
  })
);

// Fetch documents already uploaded for this token (requires OTP-verified session token)
router.get(
  '/register/:token/documents',
  requireOnboardingSession,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.getDocumentsByToken(req.params.token);
    res.json({ success: true, data });
  })
);

// Upload a document — requires OTP-verified session token
router.post(
  '/register/:token/documents',
  requireOnboardingSession,
  documentUpload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }
    const documentType = (req.body.documentType as string) || 'other';
    const data = await hrService.uploadEmployeeDocumentByToken(
      req.params.token,
      req.file,
      documentType
    );
    res.json({ success: true, data });
  })
);

export default router;
