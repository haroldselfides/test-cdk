const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

const SECRET_KEY = process.env.AES_SECRET_KEY;
if (!SECRET_KEY) {
  throw new Error('AES_SECRET_KEY must be provided via environment variables.');
}

// Derive a 32-byte key from the passphrase using SHA-256
const keyBuffer = crypto.createHash('sha256').update(SECRET_KEY).digest();
console.log('AES_SECRET_KEY length:', SECRET_KEY?.length);

const encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

const decrypt = (text) => {
  try {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err);
    return null;
  }
};

module.exports = { encrypt, decrypt };
