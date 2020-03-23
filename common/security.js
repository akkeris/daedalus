const assert = require('assert');
const crypto = require('crypto');

const IV_LENGTH = 16;
const HASH_KEY_LENGTH = 512 / 8;
const KEY_LENGTH = 192 / 8;
const CIPHER_ALGORITHM = 'aes192';
const HMAC_ALGORITHM = 'sha256';
const ENVS_BLACKLIST = process.env.ENVS_BLACKLIST || 'PASS,KEY,SECRET,PRIVATE,TOKEN,SALT,AUTH,HASH';

function hashRegex(match, p1 = '', p2 = '') {
  assert.ok(process.env.SECRET, 'The environment variable SECRET was not set.');
  const hmac = crypto.createHmac('sha256', process.env.SECRET + "hashRegex");
  return p1 + 'redacted'+hmac.update(match).digest('hex') + p2;
}

function redact(envs) {
  let blacklist_wri_regex = /([A-z0-9\-\_\.]+\:)[A-z0-9\-\_\.]+(\@tcp\([A-z0-9\-\_\.]+\:[0-9]+\)[A-z0-9\-\_\.\/]+)/;
  let blacklist_uri_regex = /([A-z]+\:\/\/[A-z0-9\-\_\.]*\:)[A-z0-9\-\_\.\*\!\&\%\^\*\(\)\=\+\`\~\,\.\<\>\?\/\\\:\;\"\'\ \t\}\{\[\]\\|\#\$}]+(\@[A-z0-9\-\_\.\:\/]+)/;
  if(!ENVS_BLACKLIST || ENVS_BLACKLIST === '') {
    return envs;
  }
  try {
    let blacklist = ENVS_BLACKLIST.split(',');
    Object.keys(envs).forEach(function(env) {
      blacklist.forEach(function(blEnv) {
        if(blEnv && blEnv !== '' && env && env !== '' && env.toLowerCase().trim().indexOf(blEnv.toLowerCase().trim()) > -1) {
          envs[env] = hashRegex(envs[env]);
        }
        if(typeof envs[env] === 'string' && (envs[env] || envs[env] === '')) {
          if(envs[env].startsWith('https://hooks.slack.com/services/')) {
            envs[env] = 'https://hooks.slack.com/services/' + hashRegex(envs[env])
          }
          if(envs[env].startsWith('https://outlook.office365.com/webhook/')) {
            envs[env] = 'https://outlook.office365.com/webhook/' + hashRegex(envs[env])
          }
          envs[env] = envs[env].replace(blacklist_uri_regex, hashRegex)
          envs[env] = envs[env].replace(blacklist_wri_regex, hashRegex)
          envs[env] = envs[env].replace(/\?password=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\&password=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\?pwd=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\&pwd=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\?access_token=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\&access_token=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\?accessToken=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\&accessToken=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\?refresh_token=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\&refresh_token=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\?refreshToken=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\&refreshToken=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\?token=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\&token=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\?client_secret=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\&client_secret=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\?clientSecret=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\&clientSecret=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\?circle-token=([^\&]+)/g, hashRegex)
          envs[env] = envs[env].replace(/\&circle-token=([^\&]+)/g, hashRegex)
        } else {
          console.warn(`The environment variable named ${env} did not have an actual value.`);
        }
      });
    });
    return envs
  } catch (e) {
    console.log('error filtering environments, returning safety response.');
    console.log(e)
    return {};
  }
}

function encryptValue(key, raw) {
  if(!Buffer.isBuffer(raw)) {
    raw = Buffer.from(raw, 'utf8');
  }
  assert.ok(CIPHER_ALGORITHM.indexOf(',') === -1, 'The cipher algorithm was invalid.');
  assert.ok(HMAC_ALGORITHM.indexOf(',') === -1, 'The hmac algorithm was invalid.');
  assert.ok(CIPHER_ALGORITHM.indexOf(':') === -1, 'The cipher algorithm was invalid.');
  assert.ok(HMAC_ALGORITHM.indexOf(':') === -1, 'The hmac algorithm was invalid.');
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
      cipher.final()
    ]),
    hash: crypto.createHmac(HMAC_ALGORITHM, key)
      .update(raw)
      .digest()
  });
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

function decryptValue(key, encToken) {
  if(Buffer.isBuffer(encToken)) {
    encToken = encToken.toString('utf8');
  }
  if(typeof encToken === 'string') {
    encToken = JSON.parse(encToken);
  }
  const token = decodeToken(encToken);
  assert.ok(key.length === token.key_length, `Key must be ${token.key_length} characters (${token.key_length * 8} bits)`);
  const decipher = crypto.createDecipheriv(token.cipher, key, token.iv);
  let decrypted = decipher.update(token.encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  const hash = crypto.createHmac(token.hmac, key)
    .update(decrypted)
    .digest();
  assert.ok(hash.equals(token.hash), `The hashes did not match while decrypting value ${JSON.stringify(encToken)}`);
  return decrypted
}

module.exports = {
  encodeToken,
  decodeToken,
  decryptValue,
  encryptValue,
  redact,
}




