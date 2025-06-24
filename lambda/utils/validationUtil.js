// lambda/utils/validationUtil.js

/**
 * Validates that a string is a valid date in MM/DD/YYYY format.
 * @param {string} dateString The date string to validate.
 * @returns {boolean} True if the date is valid, false otherwise.
 */
const isValidDate = (dateString) => {
  // Regex to check for MM/DD/YYYY format.
  // It ensures MM is 01-12, DD is 01-31, and YYYY is four digits.
  const regex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
  if (!regex.test(dateString)) {
    return false;
  }

  // The regex is good, but doesn't catch impossible dates like 02/30/2023.
  // The Date constructor can parse MM/DD/YYYY format, so we can use it for a final check.
  const d = new Date(dateString);

  // Check if the parsed date object is a valid, real calendar date.
  // isNaN(d) will be true if the date is invalid (e.g., new Date("02/30/2023")).
  return d instanceof Date && !isNaN(d);
};

/**
 * Validates a request body against a list of required fields.
 * @param {object} body The request body to validate.
 * @param {string[]} requiredFields An array of strings representing the required field names.
 * @returns {{isValid: boolean, message: string}}
 */
const validateBody = (body, requiredFields) => {
  if (!body) {
    return { isValid: false, message: 'Request body is missing or empty.' };
  }

  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return { isValid: false, message: `Bad Request: Missing or empty required field '${field}'.` };
    }
    
    // --- VALIDATION HOOK FOR MM/DD/YYYY FORMAT ---
    if (field === 'dateOfBirth' && !isValidDate(body[field])) {
        return { isValid: false, message: `Bad Request: Invalid format for 'dateOfBirth'. Please use MM/DD/YYYY.` };
    }
  }

  return { isValid: true, message: 'Validation successful.' };
};

module.exports = {
  validateBody,
};