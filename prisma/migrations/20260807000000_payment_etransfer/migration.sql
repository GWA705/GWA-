-- Add E-Transfer as a payment method (a paid method, like cash/cheque).
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'E_TRANSFER' AFTER 'CHEQUE';
