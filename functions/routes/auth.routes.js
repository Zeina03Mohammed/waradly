const { Router } = require('express');
const { auth } = require('../config/firebase');
const { APP_BASE_URL } = require('../config/env');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  verifyEmailSchema,
  zodFieldErrors,
} = require('../validation/auth');
const { createUserDoc, getUserById, updateUser } = require('../services/userService');
const { createOrganization } = require('../services/organizationService');
const { toSelfUserView } = require('../masking/user');
const { toSelfOrganizationView } = require('../masking/organization');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notifyService');
const { isLockedOut, recordFailedAttempt, resetLockout } = require('../services/lockoutService');
const identityToolkit = require('../config/identityToolkit');
const { usesFirebaseAuthMailer } = require('../services/emailChannelService');

const router = Router();

/** Creates the Firebase Auth user + Firestore user/org docs, then immediately signs in (same
 * REST path as /auth/login) so the client has real tokens right away — needed for the mandatory
 * WebAuthn/photo verification step right after registering, before email is even verified. This
 * replaces the old system's separate short-lived "enrollment token" concept entirely: since
 * Firebase Auth issues real sessions server-side now, there's no chicken-and-egg problem to
 * solve with a second token type. Email verification is still enforced at /auth/login, not here. */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));
    const data = parsed.data;

    let uid;
    try {
      const created = await auth.createUser({ email: data.email, password: data.password, emailVerified: false });
      uid = created.uid;
    } catch (err) {
      if (err.code === 'auth/email-already-exists') throw Errors.duplicateEmail();
      throw err;
    }

    let user;
    let organization;
    try {
      user = await createUserDoc(uid, { email: data.email, phone: data.phone, username: data.username, role: data.role });
      organization = await createOrganization({
        ownerUid: uid,
        type: data.role,
        legalName: data.legal_name,
        country: data.country,
        generalRegion: data.general_region,
      });
    } catch (err) {
      await auth.deleteUser(uid).catch(() => {});
      throw err;
    }

    await audit({ actorId: uid, action: 'auth.registered', entityType: 'user', entityId: uid, after: { role: data.role, email: data.email } });

    const signedIn = await identityToolkit.signInWithPassword(data.email, data.password);

    const welcome = {
      userId: uid,
      eventType: 'account.created',
      message: 'Welcome to Waradly — please verify your email to get started.',
      link: '/verify-email',
    };
    if (usesFirebaseAuthMailer) {
      await notify(welcome);
      await identityToolkit
        .sendOobCode({ requestType: 'VERIFY_EMAIL', idToken: signedIn.idToken, continueUrl: `${APP_BASE_URL}/login` })
        .catch((err) => console.error('[auth] verification email failed', err.message));
    } else {
      const verifyLink = await auth.generateEmailVerificationLink(data.email, { url: `${APP_BASE_URL}/verify-email` });
      const oobCode = new URL(verifyLink).searchParams.get('oobCode');
      await notify({
        ...welcome,
        email: {
          to: data.email,
          subject: 'Welcome to Waradly — verify your email',
          body: `Welcome to Waradly!\n\nPlease verify your email by visiting:\n${APP_BASE_URL}/verify-email?token=${oobCode}`,
        },
      });
    }

    res.status(201).json({
      user: toSelfUserView(user),
      organization: toSelfOrganizationView(organization),
      access_token: signedIn.idToken,
      refresh_token: signedIn.refreshToken,
    });
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));
    const { email, password } = parsed.data;

    let authUser;
    try {
      authUser = await auth.getUserByEmail(email);
    } catch {
      throw Errors.invalidCredentials();
    }

    const user = await getUserById(authUser.uid);
    if (!user) throw Errors.invalidCredentials();

    if (isLockedOut(user)) throw Errors.lockedOut();

    let signedIn;
    try {
      signedIn = await identityToolkit.signInWithPassword(email, password);
    } catch {
      const { lockedOut } = await recordFailedAttempt(authUser.uid, user);
      await audit({ actorId: authUser.uid, action: 'auth.login_failed', entityType: 'user', entityId: authUser.uid });
      if (lockedOut) {
        await audit({ actorId: authUser.uid, action: 'auth.lockout', entityType: 'user', entityId: authUser.uid });
        throw Errors.lockedOut();
      }
      throw Errors.invalidCredentials();
    }

    await resetLockout(authUser.uid);

    if (user.status !== 'active') throw Errors.suspended(user.status, user.status_reason);
    if (!authUser.emailVerified) throw Errors.emailNotVerified();
    // Verified through Firebase's own email link (not our /verify-email page)? Sync the mirror
    // copy — RFQ creation checks users.email_verified.
    if (!user.email_verified) {
      await updateUser(authUser.uid, { email_verified: true });
      user.email_verified = true;
    }

    await audit({ actorId: authUser.uid, action: 'auth.login', entityType: 'user', entityId: authUser.uid });

    res.json({
      access_token: signedIn.idToken,
      refresh_token: signedIn.refreshToken,
      user: toSelfUserView(user),
    });
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    try {
      const { idToken, refreshToken } = await identityToolkit.exchangeRefreshToken(parsed.data.refresh_token);
      res.json({ access_token: idToken, refresh_token: refreshToken });
    } catch {
      throw Errors.unauthenticated();
    }
  }),
);

/** Revokes every session for this user (Firebase Admin SDK has no single-refresh-token revoke —
 * a deliberate, flagged simplification vs. the old per-token revoke: logging out now signs the
 * user out everywhere, not just this device). */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await auth.revokeRefreshTokens(req.user.id);
    await audit({ actorId: req.user.id, action: 'auth.logout', entityType: 'user', entityId: req.user.id });
    res.status(204).send();
  }),
);

router.post(
  '/password-reset-request',
  asyncHandler(async (req, res) => {
    const parsed = passwordResetRequestSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    try {
      const authUser = await auth.getUserByEmail(parsed.data.email);
      const notice = { userId: authUser.uid, eventType: 'auth.password_reset_requested', message: 'A password reset was requested for your account.' };
      if (usesFirebaseAuthMailer) {
        await notify(notice);
        await identityToolkit.sendOobCode({ requestType: 'PASSWORD_RESET', email: parsed.data.email, continueUrl: `${APP_BASE_URL}/login` });
        return res.status(200).json({ ok: true });
      }
      const link = await auth.generatePasswordResetLink(parsed.data.email, { url: `${APP_BASE_URL}/reset-password` });
      const oobCode = new URL(link).searchParams.get('oobCode');
      await notify({
        ...notice,
        email: {
          to: parsed.data.email,
          subject: 'Reset your Waradly password',
          body: `Reset your password by visiting:\n${APP_BASE_URL}/reset-password?token=${oobCode}`,
        },
      });
    } catch {
      // No such account — say nothing, same 200 either way (no enumeration).
    }

    res.status(200).json({ ok: true });
  }),
);

router.post(
  '/password-reset',
  asyncHandler(async (req, res) => {
    const parsed = passwordResetSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    let result;
    try {
      result = await identityToolkit.resetPassword(parsed.data.token, parsed.data.new_password);
    } catch {
      throw Errors.invalidToken();
    }

    const authUser = await auth.getUserByEmail(result.email);
    await auth.revokeRefreshTokens(authUser.uid);
    await audit({ actorId: authUser.uid, action: 'auth.password_reset', entityType: 'user', entityId: authUser.uid });

    res.status(200).json({ ok: true });
  }),
);

router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const parsed = verifyEmailSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    let result;
    try {
      result = await identityToolkit.confirmEmailVerification(parsed.data.token);
    } catch {
      throw Errors.invalidToken();
    }

    const authUser = await auth.getUserByEmail(result.email);
    await updateUser(authUser.uid, { email_verified: true });
    await audit({ actorId: authUser.uid, action: 'auth.email_verified', entityType: 'user', entityId: authUser.uid });

    res.status(200).json({ ok: true });
  }),
);

module.exports = router;
