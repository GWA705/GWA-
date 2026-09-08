/**
 * Shared shape for auto-filling the new-customer form from a scan — a photo of a
 * driver's licence (Textract AnalyzeID) or an uploaded credit application
 * (Textract forms OCR). Every field is optional; the form fills whatever is
 * present and leaves the rest for the dealer. Dates are yyyy-mm-dd.
 */
export interface BorrowerAutofill {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dob?: string; // yyyy-mm-dd
  email?: string;
  phone?: string; // mobile
  homePhone?: string;
  maritalStatus?: string;
  address?: string;
  city?: string;
  province?: string; // 2-letter code
  postal?: string;
  monthlyHousingCost?: string;
  yearsAtAddress?: string;
  housingStatus?: string; // Own | Rent | Other
  idType?: string;
  idNumber?: string;
  idProvince?: string; // 2-letter code
  idExpiry?: string; // yyyy-mm-dd
  businessName?: string;
  positionTitle?: string;
  employerAddress?: string;
  employerPhone?: string;
  grossMonthlyIncome?: string;
  timeAtJob?: string;
}
