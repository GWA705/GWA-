-- Additional office contacts (name/role/phone/email) beyond billing + support.
ALTER TABLE "DealerProfile" ADD COLUMN "extraContacts" JSONB;
