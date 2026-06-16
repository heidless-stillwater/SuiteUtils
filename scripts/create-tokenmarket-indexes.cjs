#!/usr/bin/env node
/**
 * create-tokenmarket-indexes.cjs
 * Creates the composite index required for querying content by type and order on market_content.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { createSign } = require('crypto');

const SA_PATH = path.join(__dirname, '../suite-admin-sovereign-02.json');
const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));

const PROJECT_ID = sa.project_id || 'stillwater-sovereign-02';
const DATABASE_ID = 'tokenmarket-db-0';
const DB_PARENT = `projects/${PROJECT_ID}/databases/${DATABASE_ID}`;
const COLLECTION_ID = 'market_content';

function b64url(s) {
  return Buffer.from(s).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const hdr = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const pld = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }));
  const sign = createSign('RSA-SHA256');
  sign.update(`${hdr}.${pld}`);
  const jwt = `${hdr}.${pld}.${b64url(sign.sign(sa.private_key))}`;
  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        const p = JSON.parse(d);
        p.access_token ? resolve(p.access_token) : reject(new Error(d));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function restCall(method, urlPath, token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: urlPath,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('🔐 Loading service account:', SA_PATH);
  const token = await getToken(sa);
  console.log('✅ Token obtained\n');

  console.log('📋 Checking existing composite indexes for collection:', COLLECTION_ID);
  const listRes = await restCall(
    'GET',
    `/v1/${DB_PARENT}/collectionGroups/${COLLECTION_ID}/indexes`,
    token
  );
  
  const existingIndexes = listRes.body.indexes || [];
  console.log(`Found ${existingIndexes.length} existing indexes.`);
  
  // Check if our index already exists
  const exists = existingIndexes.some(idx => {
    const fields = idx.fields || [];
    return fields.length === 2 && 
           fields[0].fieldPath === 'type' && fields[0].order === 'ASCENDING' &&
           fields[1].fieldPath === 'order' && fields[1].order === 'ASCENDING';
  });

  if (exists) {
    console.log('✅ Index on (type: ASC, order: ASC) already exists.');
    process.exit(0);
  }

  console.log('\n📐 Creating composite index (type: ASC, order: ASC)...');
  const indexConfig = {
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'order', order: 'ASCENDING' }
    ]
  };

  const createRes = await restCall(
    'POST',
    `/v1/${DB_PARENT}/collectionGroups/${COLLECTION_ID}/indexes`,
    token,
    indexConfig
  );

  if (createRes.status === 200 || createRes.status === 202) {
    console.log('✅ Composite index creation job submitted!');
    console.log('   Operation Name:', createRes.body.name);
  } else {
    console.error('❌ Index creation failed:', JSON.stringify(createRes.body, null, 2));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
