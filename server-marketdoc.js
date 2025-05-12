const express = require('express');
const fs = require('fs');
const app = express();
const port = 3000;

// Use raw parser for XML content
app.use('/mmcHub/Response/Acknowledgement/v1.0', express.raw({
  type: 'application/xml',
  limit: '5mb'  // adjust if needed
}));

// Save the raw XML exactly as received
app.post('/mmcHub/Response/Acknowledgement/v1.0', (req, res) => {
  const rawXml = req.body.toString('utf8');
  console.log('🔍 RAW XML:\n', rawXml);


  fs.writeFileSync('./tennet_ack_response.xml', rawXml);
  console.log('✅ SOAP response saved.');

  res.status(200).send(); // Always send 200 OK back to TenneT
});

app.listen(port, () => {
  console.log(`🛰️ Listening on port ${port}`);
});
