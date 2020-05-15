const fs = require('fs');
const debug = require('debug')('daedalus:urls');
const tls = require('tls');

function mapCertificates(cert, found = []) {
  if (found.includes(cert.fingerprint)) {
    return null;
  }
  return {
    subject: cert.subject,
    subjectAlternativeName: cert.subjectaltname,
    modulus: cert.modulus,
    bits: cert.bits,
    exponent: cert.exponent,
    issued: cert.valid_from,
    expires: cert.valid_to,
    fingerprint: cert.fingerprint,
    fingerprint256: cert.fingerprint256,
    serialNumber: cert.serialNumber,
    extensionKeyUsage: cert.ext_key_usage,
    issuer: mapCertificates(cert.issuerCertificate, found.concat([cert.fingerprint])),
  };
}

let certificateCache = {};
let certificateCacheErrors = {};
let certificateCacheInterval = null;

function getCertificate(url) {
  if (!certificateCacheInterval) {
    certificateCacheInterval = setTimeout(() => {
      certificateCache = {};
      certificateCacheErrors = {};
    }, 5 * 60 * 1000);
  }
  return new Promise((res, rej) => {
    if (certificateCache[url]) {
      res(url);
      return;
    }
    if (certificateCacheErrors[url]) {
      rej(url);
      return;
    }
    const { hostname, port } = new URL(url);
    const options = {
      host: hostname, port: port || 443, ALPNProtocols: ['http/1.1', 'http/1.0'], servername: hostname, rejectUnauthorized: false,
    };
    let error = null;
    let response = null;
    const client = tls.connect(options, () => {
      response = JSON.parse(JSON.stringify({
        certificate: mapCertificates(client.getPeerCertificate(true)),
        connection: {
          protocol: client.getProtocol(),
          algorithm: client.getCipher(),
          algorithms: client.getSharedSigalgs(),
          key: client.getEphemeralKeyInfo(),
        },
      }));
      client.end();
    });
    client.once('close', (hasError) => {
      if (hasError) {
        certificateCacheErrors[url] = error;
        rej(error);
      } else {
        certificateCache[url] = response;
        res(response);
      }
    });
    client.once('error', (e) => (error = e)); // eslint-disable-line no-return-assign
    client.once('timeout', () => client.destroy(new Error('Timeout occured')));
    client.setTimeout(15000);
  });
}

async function writeCertificateChain(pgpool, issuer, certificateType) {
  let iss = [];
  if (issuer.issuer) {
    iss = await writeCertificateChain(pgpool, issuer.issuer, certificateType);
  }
  const fingerprint160 = issuer.fingerprint.split(':').map((x) => Buffer.from(x, 'hex')).reduce((acc, item) => Buffer.concat([acc, item]), Buffer.alloc(0)).toString('hex');
  const fingerprint256 = issuer.fingerprint256.split(':').map((x) => Buffer.from(x, 'hex')).reduce((acc, item) => Buffer.concat([acc, item]), Buffer.alloc(0)).toString('hex');
  const subject = Object.keys(issuer.subject).map((x) => `${x.toLowerCase()}=${issuer.subject[x]}`).join('/');
  const alternative = issuer.subjectAlternativeName ? issuer.subjectAlternativeName.split(',').map((x) => x.replace('DNS:', '').trim()) : [issuer.subject.CN];
  const { rows: [{ certificate_log }] } = await pgpool.query( // eslint-disable-line camelcase
    ` insert into urls.certificates_log 
      (certificate_log, fingerprint_hex_160, fingerprint_hex_256, subject, alternative_names, serial_number, issued, expires, issuer, definition, deleted)
    values
      (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    on conflict (fingerprint_hex_160, fingerprint_hex_256, deleted)
    do update set deleted = false
    returning certificate_log
  `, [fingerprint160, fingerprint256, subject, alternative, issuer.serialNumber, issuer.issued, issuer.expires, iss[0], issuer, false],
  );
  await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do update set name = $2',
    [certificate_log, subject, certificateType]); // eslint-disable-line camelcase
  if (issuer.issuer) {
    await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
      [certificate_log, iss[0]]); // eslint-disable-line camelcase
  }
  return [certificate_log].concat(iss); // eslint-disable-line camelcase
}

async function addHttpLinkBetween(pgpool, type, node, name, def, uri, urlType, certificateType) {
  let cert = [];
  let conn = null;
  let response = null;
  if (uri.protocol === 'https:') {
    try {
      response = await getCertificate(`https://${uri.host}`);
      cert = await writeCertificateChain(pgpool, response.certificate, certificateType);
      conn = response.connection;
    } catch (e) {
      // eslint-disable-line no-empty
    }
  }
  const definition = { url: { ...JSON.parse(JSON.stringify(uri)), connection: conn } };
  const { rows: [{ url_log }] } = await pgpool.query( // eslint-disable-line camelcase
    ` insert into urls.urls_log 
      (url_log, protocol, hostname, port, pathname, certificate, definition, deleted)
    values
      (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
    on conflict (protocol, hostname, port, pathname, deleted)
    do update set deleted = false, certificate = $5
    returning url_log
  `, [uri.protocol, uri.hostname, uri.port, uri.pathname, cert[0], definition, false],
  );

  await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do update set name = $2',
    [node, name, type]); // eslint-disable-line camelcase

  await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do update set name = $2',
    [url_log, `${uri.toString()}`, urlType]); // eslint-disable-line camelcase

  if (response && cert.length > 0) {
    await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
      [url_log, cert[0]]); // eslint-disable-line camelcase
  }

  await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
    [node, url_log]); // eslint-disable-line camelcase

  // if(uri.protocol === 'http:' && uri.hostname.endsWith(".svc.cluster.local")) {
  // is a kubernetes service
  // }
  return { url_log, certificates: cert };
}

async function writeHttpFromConfigMaps(pgpool, urlType, certificateType) {
  const examine = [];
  const { rows: configMapRecords } = await pgpool.query('select * from kubernetes.config_maps');
  debug(`Examining ${configMapRecords.length} configMaps for envs that have a http/https string.`);
  const configMapType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/config_maps\'')).rows[0].type;
  await Promise.all(configMapRecords.map(async (configMap) => {
    if (configMap.definition.data) {
      await Promise.all(Object.keys(configMap.definition.data).map(async (env) => {
        if (configMap.definition.data[env].startsWith('http://') || configMap.definition.data[env].startsWith('https://')) {
          if (configMap.definition.data[env] !== 'http://' && configMap.definition.data[env] !== 'https://') {
            try {
              examine.push([configMapType, configMap.config_map, `${configMap.definition.metadata.namespace}/${configMap.name}`, configMap.definition, new URL(configMap.definition.data[env]), urlType, certificateType]);
            } catch (e) {
              debug(`Error adding http link from configmap ${configMap.config_map}, due to: ${e.stack}`); // eslint-disable-line no-console
            }
          }
        }
      }), []);
    }
  }));
  const added = [];
  for (const item of examine) { // eslint-disable-line no-restricted-syntax
    added.push(await addHttpLinkBetween(pgpool, ...item)); // eslint-disable-line no-await-in-loop
  }
  return added;
}

async function writeHttpFromReplicaSets(pgpool, urlType, certificateType) {
  const examine = [];
  const { rows: replicaSetRecords } = await pgpool.query('select * from kubernetes.replicasets');
  debug(`Examining ${replicaSetRecords.length} replicaset for envs that have a http/https string.`);
  const replicaSetType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/replicasets\'')).rows[0].type;
  await Promise.all(replicaSetRecords.map(async (replicaSet) => {
    await Promise.all((replicaSet.definition.spec.template.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && (env.value.startsWith('http://') || env.value.startsWith('https://'))))
        .map(async (env) => {
          if (env.value && env.value !== 'https://' && env.value !== 'http://') {
            try {
              examine.push([replicaSetType, replicaSet.replicaset, `${replicaSet.definition.metadata.namespace}/${replicaSet.name}`, replicaSet.definition, new URL(env.value), urlType, certificateType]);
            } catch (e) {
              debug(`Error adding http link entry from replicaset ${replicaSet.replicaset} due to: ${e.stack}`); // eslint-disable-line no-console
            }
          }
        }), []));
  }));
  const added = [];
  for (const item of examine) { // eslint-disable-line no-restricted-syntax
    added.push(await addHttpLinkBetween(pgpool, ...item)); // eslint-disable-line no-await-in-loop
  }
  return added;
}

async function writeHttpFromPods(pgpool, urlType, certificateType) {
  const examine = [];
  const { rows: podRecords } = await pgpool.query('select * from kubernetes.pods');
  debug(`Examining ${podRecords.length} pods for envs that have a http/https string.`);
  const podType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/pods\'')).rows[0].type;
  await Promise.all(podRecords.map(async (pod) => {
    await Promise.all((pod.definition.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && (env.value.startsWith('http://') || env.value.startsWith('https://'))))
        .map(async (env) => {
          if (env.value && env.value !== 'http://' && env.value !== 'https://') {
            try {
              examine.push([podType, pod.pod, `${pod.definition.metadata.namespace}/${pod.name}`, pod.definition, new URL(env.value), urlType, certificateType]);
            } catch (e) {
              debug(`Error adding http link entry from pod ${pod.pod} due to: ${e.stack}`); // eslint-disable-line no-console
            }
          }
        }), []));
  }));
  const added = [];
  for (const item of examine) { // eslint-disable-line no-restricted-syntax
    added.push(await addHttpLinkBetween(pgpool, ...item)); // eslint-disable-line no-await-in-loop
  }
  return added;
}

async function writeHttpFromDeployments(pgpool, urlType, certificateType) {
  const examine = [];
  const { rows: deploymentRecords } = await pgpool.query('select * from kubernetes.deployments');
  debug(`Examining ${deploymentRecords.length} deployment for envs that have a http/https string.`);
  const deploymentType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/deployments\'')).rows[0].type;
  await Promise.all(deploymentRecords.map(async (deployment) => {
    await Promise.all((deployment.definition.spec.template.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && (env.value.startsWith('http://') || env.value.startsWith('https://'))))
        .map(async (env) => {
          if (env.value && env.value !== 'http://' && env.value !== 'https://') {
            try {
              examine.push([deploymentType, deployment.deployment, `${deployment.definition.metadata.namespace}/${deployment.name}`, deployment.definition, new URL(env.value), urlType, certificateType]);
            } catch (e) {
              debug(`Error adding http link entry from deployment ${deployment.deployment} due to: ${e.stack}`); // eslint-disable-line no-console
            }
          }
        }), []));
  }));
  const added = [];
  for (const item of examine) { // eslint-disable-line no-restricted-syntax
    added.push(await addHttpLinkBetween(pgpool, ...item)); // eslint-disable-line no-await-in-loop
  }
  return added;
}

async function run(pgpool) {
  if (process.env.URLS !== 'true') {
    return;
  }
  debug('Running urls plugin...');
  const urlType = (await pgpool.query('select "type" from metadata.node_types where name = \'urls/urls\'')).rows[0].type;
  const certificateType = (await pgpool.query('select "type" from metadata.node_types where name = \'urls/certificates\'')).rows[0].type;
  const urlsAndCerts = [
    ...await writeHttpFromConfigMaps(pgpool, urlType, certificateType),
    ...await writeHttpFromReplicaSets(pgpool, urlType, certificateType),
    ...await writeHttpFromPods(pgpool, urlType, certificateType),
    ...await writeHttpFromDeployments(pgpool, urlType, certificateType),
  ];
  // detect delections
  const { rows: activeUrls } = await pgpool.query('select url_log, protocol, hostname, port, pathname, definition, certificate from urls.urls');
  activeUrls.filter((u) => !urlsAndCerts.some((v) => u.url_log === v.url_log)).map(async (deadUrl) => { // eslint-disable-line max-len
    await pgpool.query(`
      insert into urls.urls_log 
        (url_log, protocol, hostname, port, pathname, definition, certificate, deleted) 
      values 
        (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
      on conflict do nothing
    `, [deadUrl.protocol, deadUrl.hostname, deadUrl.port, deadUrl.pathname, deadUrl.definition, deadUrl.certificate, true]);
  });

  // detect deletions in urls and certificates
  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select url_log from urls.urls)', [urlType]);
  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select certificate_log from urls.certificates)', [certificateType]);
  debug('Running urls plugin... done');
}

async function init(pgpool) {
  debug('Initializing urls plugin...');
  await pgpool.query(fs.readFileSync('./plugins/urls/create.sql').toString());
  debug('Initializing urls plugin... done');
}


module.exports = {
  init,
  run,
};