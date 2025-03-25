const http = require('http');
const { parseStringPromise } = require('xml2js');

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST') {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', async () => {
      console.log('\n📥 Received SOAP message:\n', data);

      // Optional: parse and respond with XML
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      res.end(`
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <AcknowledgementResponse xmlns="http://tennet.eu/cdm/tennet/TennetService/Message/v2.0">
              <status>RECEIVED</status>
            </AcknowledgementResponse>
          </soap:Body>
        </soap:Envelope>
      `);
    });
  } else {
    res.writeHead(405);
    res.end();
  }
});

server.listen(3000, () => {
  console.log('🟢 HTTP server listening on port 3000');
});
