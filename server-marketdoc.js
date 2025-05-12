const express = require('express');
const fs = require('fs');
const app = express();
const port = 3000;

app.use('/mmcHub/Response/Acknowledgement/v1.0', express.raw({
  type: (req) => true,
  limit: '5mb'
}));

app.post('/mmcHub/Response/Acknowledgement/v1.0', (req, res) => {
  if (!req.body) {
    console.error('❌ No body received');
    return res.status(400).send('Missing body');
  }

  const rawXml = req.body.toString('utf8');
  fs.writeFileSync('./tennet_ack_response.xml', rawXml);
  console.log('✅ Saved raw XML');

  res.status(200).send();
});


app.listen(port, () => {
  console.log(`🛰️ Listening on port ${port}`);
});
