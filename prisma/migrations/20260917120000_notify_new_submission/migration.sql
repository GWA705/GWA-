-- Per-user opt-out for the new-deal / funding-package submission alerts (email +
-- push to reviewers/admins). Defaults true so everyone gets them unless they turn
-- it off in My account.
ALTER TABLE "User" ADD COLUMN "notifyNewSubmission" BOOLEAN NOT NULL DEFAULT true;
