const http = require('http');

const data = JSON.stringify({
  identifier: '03331973564',
  password: '' // Sending empty password to trigger needsProfileCompletion
});

const options = {
  hostname: 'localhost',
  port: 5002, // Assuming the server runs on 5002, or I can use the local route
  path: '/api/guardian/access',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log(JSON.stringify(JSON.parse(body), null, 2));
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.write(data);
req.end();
