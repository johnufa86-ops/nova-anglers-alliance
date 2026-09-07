-- Full merged schema for NOVA (Stage 4-6.5)
-- Idempotent: drops and recreates

DROP TABLE IF EXISTS "EmailLog" CASCADE;
DROP TABLE IF EXISTS "EmailVerification" CASCADE;
DROP TABLE IF EXISTS "Document" CASCADE;
DROP TABLE IF EXISTS "CompetitionResult" CASCADE;
DROP TABLE IF EXISTS "RatingEntry" CASCADE;
DROP TABLE IF EXISTS "PaymentDetails" CASCADE;
DROP TABLE IF EXISTS "Payment" CASCADE;
DROP TABLE IF EXISTS "ApplicationDocument" CASCADE;
DROP TABLE IF EXISTS "ApplicationStatusHistory" CASCADE;
DROP TABLE IF EXISTS "ApplicationParticipant" CASCADE;
DROP TABLE IF EXISTS "Counter" CASCADE;
DROP TABLE IF EXISTS "Application" CASCADE;
DROP TABLE IF EXISTS "TeamMember" CASCADE;
DROP TABLE IF EXISTS "Team" CASCADE;
DROP TABLE IF EXISTS "Competition" CASCADE;
DROP TABLE IF EXISTS "Athlete" CASCADE;
DROP TABLE IF EXISTS "OrganizerAssignment" CASCADE;
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- Also drop old lowercase tables from supabase schema if they exist
DROP TABLE IF EXISTS email_log CASCADE;
DROP TABLE IF EXISTS email_verifications CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS application_documents CASCADE;
DROP TABLE IF EXISTS application_status_history CASCADE;
DROP TABLE IF EXISTS application_participants CASCADE;
DROP TABLE IF EXISTS counters CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS competitions CASCADE;
DROP TABLE IF EXISTS athletes CASCADE;
DROP TABLE IF EXISTS organizer_assignments CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS payments CASCADE;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User
CREATE TABLE "User" (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  name TEXT DEFAULT 'User',
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "verificationToken" TEXT,
  "resetToken" TEXT,
  "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

-- Session
CREATE TABLE "Session" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- Competition (merged)
CREATE TABLE "Competition" (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Tournament',
  description TEXT DEFAULT '',
  discipline TEXT DEFAULT 'spinning',
  category TEXT DEFAULT 'open',
  location TEXT DEFAULT '',
  date TIMESTAMPTZ(3),
  "registrationDeadline" TIMESTAMPTZ(3),
  "maxParticipants" INTEGER DEFAULT 100,
  fee DOUBLE PRECISION DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'upcoming',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  -- old fields
  name TEXT DEFAULT '',
  "shortName" TEXT DEFAULT '',
  "disciplineLabel" TEXT DEFAULT '',
  "entryType" TEXT DEFAULT 'both',
  region TEXT DEFAULT '',
  "startDate" TIMESTAMPTZ(3),
  "endDate" TIMESTAMPTZ(3),
  "dateLabel" TEXT DEFAULT '',
  "registrationOpenAt" TIMESTAMPTZ(3),
  "registrationCloseAt" TIMESTAMPTZ(3),
  "maxEntries" INTEGER DEFAULT 0,
  format TEXT DEFAULT '',
  "prizeFund" TEXT DEFAULT '',
  days INTEGER DEFAULT 1,
  "pointsMultiplier" TEXT DEFAULT '×1.0',
  organizer TEXT DEFAULT 'NOVA Anglers Alliance',
  contact TEXT DEFAULT '',
  content TEXT DEFAULT '{}',
  "entryFee" INTEGER DEFAULT 0
);

-- OrganizerAssignment
CREATE TABLE "OrganizerAssignment" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "competitionId" TEXT NOT NULL REFERENCES "Competition"(id) ON DELETE CASCADE,
  "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  UNIQUE("userId", "competitionId")
);

-- Team
CREATE TABLE "Team" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT '',
  club TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

-- Athlete
CREATE TABLE "Athlete" (
  id TEXT PRIMARY KEY,
  "userId" TEXT UNIQUE REFERENCES "User"(id) ON DELETE SET NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "middleName" TEXT,
  "displayName" TEXT DEFAULT '',
  "birthDate" TIMESTAMPTZ(3),
  gender TEXT,
  city TEXT,
  club TEXT,
  "sportsCategory" TEXT,
  phone TEXT,
  email TEXT,
  region TEXT DEFAULT '',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX "Athlete_email_idx" ON "Athlete"(email);

-- TeamMember
CREATE TABLE "TeamMember" (
  id TEXT PRIMARY KEY,
  "teamId" TEXT NOT NULL REFERENCES "Team"(id) ON DELETE CASCADE,
  "athleteId" TEXT NOT NULL REFERENCES "Athlete"(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  UNIQUE("teamId", "athleteId")
);

-- Counter
CREATE TABLE "Counter" (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

-- Application (merged)
CREATE TABLE "Application" (
  id TEXT PRIMARY KEY,
  "athleteId" TEXT REFERENCES "Athlete"(id) ON DELETE CASCADE,
  "competitionId" TEXT NOT NULL REFERENCES "Competition"(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  fee DOUBLE PRECISION DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  -- old fields
  "applicationNumber" TEXT UNIQUE,
  "entryType" TEXT DEFAULT 'athlete',
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "accessToken" TEXT,
  "teamId" TEXT REFERENCES "Team"(id) ON DELETE SET NULL,
  "userId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "rawPayload" TEXT DEFAULT '{}',
  notes TEXT DEFAULT '',
  source TEXT DEFAULT 'web',
  "submittedAt" TIMESTAMPTZ(3) DEFAULT now(),
  "reviewedAt" TIMESTAMPTZ(3),
  "reviewedBy" TEXT,
  comment TEXT
);
CREATE INDEX "Application_competitionId_idx" ON "Application"("competitionId");
CREATE INDEX "Application_contactEmail_idx" ON "Application"("contactEmail");
CREATE INDEX "Application_userId_idx" ON "Application"("userId");

-- Partial unique index for active applications (competition + email)
CREATE UNIQUE INDEX IF NOT EXISTS applications_active_contact_uniq
  ON "Application" ("competitionId", "contactEmail")
  WHERE status NOT IN ('rejected', 'withdrawn');

-- ApplicationParticipant
CREATE TABLE "ApplicationParticipant" (
  id TEXT PRIMARY KEY,
  "applicationId" TEXT NOT NULL REFERENCES "Application"(id) ON DELETE CASCADE,
  "athleteId" TEXT NOT NULL REFERENCES "Athlete"(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX "ApplicationParticipant_applicationId_idx" ON "ApplicationParticipant"("applicationId");

-- ApplicationStatusHistory
CREATE TABLE "ApplicationStatusHistory" (
  id TEXT PRIMARY KEY,
  "applicationId" TEXT NOT NULL REFERENCES "Application"(id) ON DELETE CASCADE,
  "oldStatus" TEXT,
  "newStatus" TEXT NOT NULL,
  "changedById" TEXT,
  comment TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX "ApplicationStatusHistory_applicationId_idx" ON "ApplicationStatusHistory"("applicationId");

-- ApplicationDocument
CREATE TABLE "ApplicationDocument" (
  id TEXT PRIMARY KEY,
  "applicationId" TEXT NOT NULL REFERENCES "Application"(id) ON DELETE CASCADE,
  "filePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "documentType" TEXT NOT NULL DEFAULT '',
  "uploadedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

-- Payment (merged)
CREATE TABLE "Payment" (
  id TEXT PRIMARY KEY,
  "applicationId" TEXT NOT NULL UNIQUE REFERENCES "Application"(id) ON DELETE CASCADE,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  status TEXT NOT NULL DEFAULT 'pending',
  "transactionId" TEXT UNIQUE,
  provider TEXT,
  method TEXT NOT NULL DEFAULT 'online',
  "proofFileUrl" TEXT,
  "proofStatus" TEXT,
  "rejectReason" TEXT,
  "confirmedById" TEXT,
  "confirmedAt" TIMESTAMPTZ(3),
  "providerId" TEXT,
  "paidAt" TIMESTAMPTZ(3),
  "refundReason" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

-- PaymentDetails
CREATE TABLE "PaymentDetails" (
  id TEXT PRIMARY KEY,
  "competitionId" TEXT UNIQUE REFERENCES "Competition"(id) ON DELETE CASCADE,
  "bankName" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  bik TEXT NOT NULL,
  inn TEXT,
  "recipientName" TEXT NOT NULL,
  "paymentPurpose" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

-- RatingEntry
CREATE TABLE "RatingEntry" (
  id TEXT PRIMARY KEY,
  "athleteId" TEXT NOT NULL REFERENCES "Athlete"(id) ON DELETE CASCADE,
  "competitionId" TEXT NOT NULL REFERENCES "Competition"(id) ON DELETE CASCADE,
  place INTEGER NOT NULL,
  points INTEGER NOT NULL,
  season TEXT NOT NULL,
  "calculatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  UNIQUE("athleteId", "competitionId")
);

-- CompetitionResult
CREATE TABLE "CompetitionResult" (
  id TEXT PRIMARY KEY,
  "athleteId" TEXT NOT NULL REFERENCES "Athlete"(id) ON DELETE CASCADE,
  "competitionId" TEXT NOT NULL REFERENCES "Competition"(id) ON DELETE CASCADE,
  place INTEGER NOT NULL,
  score DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  UNIQUE("athleteId", "competitionId")
);

-- Document (merged)
CREATE TABLE "Document" (
  id TEXT PRIMARY KEY,
  "athleteId" TEXT REFERENCES "Athlete"(id) ON DELETE CASCADE,
  "userId" TEXT REFERENCES "User"(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  "rejectionReason" TEXT,
  "fileName" TEXT DEFAULT '',
  "fileSize" INTEGER DEFAULT 0,
  "mimeType" TEXT DEFAULT '',
  "rejectReason" TEXT,
  "reviewedAt" TIMESTAMPTZ(3),
  "reviewedById" TEXT,
  "uploadedAt" TIMESTAMPTZ(3) DEFAULT now(),
  "expiresAt" TIMESTAMPTZ(3),
  "fileKey" TEXT,
  "sizeBytes" INTEGER,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX "Document_userId_idx" ON "Document"("userId");
CREATE INDEX "Document_athleteId_idx" ON "Document"("athleteId");

-- EmailVerification
CREATE TABLE "EmailVerification" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "verifiedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX "EmailVerification_userId_idx" ON "EmailVerification"("userId");

-- EmailLog
CREATE TABLE "EmailLog" (
  id TEXT PRIMARY KEY,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "userId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "to" TEXT NOT NULL,
  template TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX "EmailLog_userId_createdAt_idx" ON "EmailLog"("userId", "createdAt");
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
