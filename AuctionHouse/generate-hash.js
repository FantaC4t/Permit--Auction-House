const crypto = require('crypto');

function hashPassword(password, salt) {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

const password = 'password';
const salt = crypto.randomBytes(16).toString('hex');
const hashedPassword = hashPassword(password, salt);

console.log('Salt:', salt);
console.log('Hashed Password:', hashedPassword);