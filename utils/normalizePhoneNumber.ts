// utils/normalizePhoneNumber.ts
import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizePhoneNumber(rawPhone: string, defaultCountry: any = "IN"): string {
  let phoneInput = rawPhone;

  if (!phoneInput.startsWith("+")) {
    phoneInput = "+" + phoneInput;
  }

  const phoneNumberObj = parsePhoneNumberFromString(phoneInput, defaultCountry);

  if (!phoneNumberObj || !phoneNumberObj.isValid()) {
    throw new Error("Invalid phone number");
  }

  return phoneNumberObj.number;
}
