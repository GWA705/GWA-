-- Remove SOAP from the "Product(s) sold" checklist. It's archived rather than
-- deleted so history (deals that list SOAP as a string) is untouched, and so the
-- auto-promote rule never resurfaces it: promotion excludes any name that already
-- exists as a Product, active or archived.
UPDATE "Product" SET "active" = false WHERE lower(trim("name")) = 'soap';
