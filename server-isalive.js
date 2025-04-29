const express = require('express');
const bodyParser = require('body-parser');
const xml2js = require('xml2js');

const app = express();
const port = 3010;

// Middleware voor raw XML-body
app.use(bodyParser.text({ type: '*/xml' }));

// Endpoint voor Acknowledgement
app.post('/mmcHub/Response/isAlive/v1.0', (req, res) => {
    const xml = req.body;

    console.log('Ontvangen SOAP bericht:');
    console.log(xml);

    // Optioneel: XML omzetten naar JSON
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
        if (err) {
            console.error('Fout bij XML-parsing:', err);
            return res.status(400).send('Ongeldige XML');
        }

        console.log('Geparste inhoud:', JSON.stringify(result, null, 2));

        // Verwerk hier de inhoud zoals nodig
        // Bijvoorbeeld responseId loggen:
        // const responseId = result['soap:Envelope']['soap:Body'].SomeElement.ResponseID;

        // Verzend SOAP-achtige response (indien TenneT die verwacht)
        res.set('Content-Type', 'text/xml');
        res.send(`<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AcknowledgementResponse xmlns="http://www.tennet.eu/mmcHub/">
      <Status>Success</Status>
    </AcknowledgementResponse>
  </soap:Body>
</soap:Envelope>`);
    });
});

app.listen(port, () => {
    console.log(`Node.js luistert op http://localhost:${port}`);
});
