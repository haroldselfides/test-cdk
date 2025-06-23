const Joi = require('joi');

const employeeSchema = Joi.object({
  firstName: Joi.string().trim().min(1),
  lastName: Joi.string().trim().min(1),
  middleName: Joi.string().trim().allow('', null),
  preferredName: Joi.string().trim().min(1),
  nationalId: Joi.string().trim().min(1),
  dateOfBirth: Joi.string().pattern(/^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/)
    .message('dateOfBirth must be in MM/DD/YYYY format'),
  gender: Joi.string().valid('Male', 'Female', 'Other'),
  nationality: Joi.string().trim(),
  maritalStatus: Joi.string().valid('Single', 'Married', 'Divorced', 'Widowed'),
  status: Joi.string().valid('Active', 'Inactive'),
});

// Define fields that require encryption
const fieldConfig = {
  firstName     : true,
  lastName      : true,
  middleName    : true,
  preferredName : false,
  nationalId    : true,
  dateOfBirth   : false,
  age           : false,
  gender        : false,
  nationality   : false,
  maritalStatus : false,
  status: false
};

module.exports = {
  employeeSchema,
  fieldConfig,
};