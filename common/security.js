const assert = require('assert');
const crypto = require('crypto');

const IV_LENGTH = 16;
const HASH_KEY_LENGTH = 512 / 8;
const KEY_LENGTH = 192 / 8;
const CIPHER_ALGORITHM = 'aes192';
const HMAC_ALGORITHM = 'sha256';
const ENVS_BLACKLIST = process.env.ENVS_BLACKLIST || 'PASS,KEY,SECRET,PRIVATE,TOKEN,SALT,AUTH,HASH,PASSWORD';

function hashRegex(match, p1 = '', p2 = '') {
  assert.ok(process.env.HASH_SECRET, 'The environment variable HASH_SECRET was not set.');
  const hmac = crypto.createHmac('sha256', `${process.env.HASH_SECRET}hashRegex`);
  return `${p1}redacted${hmac.update(match).digest('hex')}${p2}`;
}

function redact(envsFrom) {
  const envs = JSON.parse(JSON.stringify(envsFrom)); // create a copy without references
  const blacklistWriRegex = /([A-z0-9\-\_\.]+\:)[A-z0-9\-\_\.]+(\@tcp\([A-z0-9\-\_\.]+\:[0-9]+\)[A-z0-9\-\_\.\/]+)/; // eslint-disable-line no-useless-escape
  const blacklistUriRegex = /([A-z]+\:\/\/[A-z0-9\-\_\.]*\:)[A-z0-9\-\_\.\*\!\&\%\^\*\(\)\=\+\`\~\,\.\<\>\?\/\\\:\;\"\'\ \t\}\{\[\]\\|\#\$}]+(\@[A-z0-9\-\_\.\:\/]+)/; // eslint-disable-line no-useless-escape
  if (!ENVS_BLACKLIST || ENVS_BLACKLIST === '') {
    return envs;
  }
  try {
    const blacklist = ENVS_BLACKLIST.split(',');
    Object.keys(envs).forEach((env) => {
      blacklist.forEach((blEnv) => {
        if (blEnv && blEnv !== '' && env && env !== '' && env.toLowerCase().trim().indexOf(blEnv.toLowerCase().trim()) > -1) {
          envs[env] = hashRegex(envs[env]);
        }
        if (typeof envs[env] === 'string' && (envs[env] || envs[env] === '')) {
          if (envs[env].startsWith('https://hooks.slack.com/services/')) {
            envs[env] = `https://hooks.slack.com/services/${hashRegex(envs[env])}`;
          }
          if (envs[env].startsWith('https://outlook.office365.com/webhook/')) {
            envs[env] = `https://outlook.office365.com/webhook/${hashRegex(envs[env])}`;
          }
          envs[env] = envs[env].replace(blacklistUriRegex, hashRegex);
          envs[env] = envs[env].replace(blacklistWriRegex, hashRegex);
          envs[env] = envs[env].replace(/\?password=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\&password=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\?pwd=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\&pwd=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\?access_token=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\&access_token=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\?accessToken=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\&accessToken=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\?refresh_token=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\&refresh_token=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\?refreshToken=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\&refreshToken=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\?token=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\&token=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\?client_secret=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\&client_secret=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\?clientSecret=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\&clientSecret=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\?circle-token=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
          envs[env] = envs[env].replace(/\&circle-token=([^\&]+)/g, hashRegex); // eslint-disable-line no-useless-escape
        } else {
          console.warn(`The environment variable named ${env} did not have an actual value.`); // eslint-disable-line no-console
        }
      });
    });
    return envs;
  } catch (e) {
    console.log('error filtering environments, returning safety response.'); // eslint-disable-line no-console
    console.log(e); // eslint-disable-line no-console
    return {};
  }
}

function encodeToken(encToken) {
  assert.ok(encToken.cipher, 'No cipher was found.');
  assert.ok(encToken.encrypted, 'No encrypted portion found.');
  assert.ok(encToken.cipher, 'No cipher was found.');
  assert.ok(encToken.iv, 'No iv field was found.');
  assert.ok(encToken.hmac, 'No hmac algorithm found.');
  return {
    ...encToken,
    encrypted: encToken.encrypted.toString('hex'),
    iv: encToken.iv.toString('hex'),
    hash: encToken.hash.toString('hex'),
  };
}

function encryptValue(key, rawFrom) {
  const raw = Buffer.from(rawFrom);
  assert.ok(typeof HASH_KEY_LENGTH === 'number' && HASH_KEY_LENGTH > 0, 'The hash key length was invalid.');
  assert.ok(key.length === KEY_LENGTH, `Key must be ${KEY_LENGTH} characters (${KEY_LENGTH * 8} bits)`);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, key, iv);
  return encodeToken({
    iv: iv.toString('hex'),
    cipher: CIPHER_ALGORITHM,
    hmac: HMAC_ALGORITHM,
    key_length: KEY_LENGTH,
    encrypted: Buffer.concat([
      cipher.update(raw),
      cipher.final(),
    ]),
    hash: crypto.createHmac(HMAC_ALGORITHM, process.env.HASH_SECRET)
      .update(raw)
      .digest(),
  });
}

function decodeToken(encToken) {
  assert.ok(encToken.cipher, 'No cipher was found.');
  assert.ok(encToken.encrypted, 'No encrypted portion found.');
  assert.ok(encToken.cipher, 'No cipher was found.');
  assert.ok(encToken.iv, 'No iv field was found.');
  assert.ok(encToken.hmac, 'No hmac algorithm found.');

  return {
    ...encToken,
    encrypted: Buffer.from(encToken.encrypted, 'hex'),
    iv: Buffer.from(encToken.iv, 'hex'),
    hash: Buffer.from(encToken.hash, 'hex'),
  };
}

function decryptValue(key, encTokenFrom) {
  let encToken = Buffer.isBuffer(encTokenFrom) ? encTokenFrom.toString('utf8') : encTokenFrom;
  if (typeof encToken === 'string') {
    encToken = JSON.parse(encToken);
  }
  const token = decodeToken(encToken);
  assert.ok(key.length === token.key_length, `Key must be ${token.key_length} characters (${token.key_length * 8} bits)`);
  const decipher = crypto.createDecipheriv(token.cipher, key, token.iv);
  let decrypted = decipher.update(token.encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  const hash = crypto.createHmac(token.hmac, process.env.HASH_SECRET)
    .update(decrypted)
    .digest();
  assert.ok(hash.equals(token.hash), `The hashes did not match while decrypting value ${JSON.stringify(encToken)}`);
  return decrypted;
}

module.exports = {
  encodeToken,
  decodeToken,
  decryptValue,
  encryptValue,
  redact,
};
