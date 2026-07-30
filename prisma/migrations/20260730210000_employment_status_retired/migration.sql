-- Add "RETIRED" to the EmploymentStatus enum, ordered after SELF_EMPLOYED.
ALTER TYPE "EmploymentStatus" ADD VALUE IF NOT EXISTS 'RETIRED' AFTER 'SELF_EMPLOYED';
