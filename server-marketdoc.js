const express = require('express');
const fs = require('fs');
const app = express();
const port = 3000;
const xml2js = require('xml2js'); 

app.use('/mmcHub/Response/Acknowledgement/v1.0', express.raw({
  type: (req) => true,
  limit: '5mb'
}));

app.post('/mmcHub/Response/Acknowledgement/v1.0', async (req, res) => {
  const rawXml = req.body.toString('utf8');
  fs.writeFileSync('./tennet_ack_response.xml', rawXml);
  console.log('✅ Saved raw XML');
  console.log(rawXml);

  try {
    const parsed = await xml2js.parseStringPromise(rawXml, { explicitArray: false });
    const correlationId = parsed?.['SOAP-ENV:Envelope']?.['SOAP-ENV:Body']?.['Acknowledgement']?.['ns2:correlationId'];

    const soapResponse = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
    <AcknowledgementResponse xmlns="http://sys.svc.tennet.nl/AncillaryServices/v1"
                             xmlns:ns2="http://sys.svc.tennet.nl/MMCHub/common/v1">
      <ns2:correlationId>${correlationId || ''}</ns2:correlationId>
    </AcknowledgementResponse>
  </soapenv:Body>
</soapenv:Envelope>
    `.trim();

    res.set('Content-Type', 'text/xml');
    console.log("response :\r\n")
    console.log(soapResponse)
    res.status(200).send(soapResponse);
  } catch (err) {
    console.error('❌ Failed to parse XML:', err);
    res.status(500).send('Invalid XML');
  }
});


app.listen(port, () => {
  console.log(`🛰️ Listening on port ${port}`);
});
