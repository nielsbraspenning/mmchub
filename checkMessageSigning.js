const fs = require('fs');
const { DOMParser } = require('xmldom');
const c14n = require('xml-c14n')();
const crypto = require('crypto');

// Load and parse the trimmed XML file (only <soapenv:Body> in file)
const xmlData = fs.readFileSync('response_tennet.xml', 'utf8');
const doc = new DOMParser().parseFromString(xmlData, 'text/xml');

// Use root node directly
const bodyNode = doc.documentElement;

// Canonicalize it
const canonicaliser = c14n.createCanonicaliser('http://www.w3.org/2001/10/xml-exc-c14n#');
canonicaliser.canonicalise(bodyNode, function (err, result) {
  if (err) {
    console.error('Canonicalization error:', err);
    return;
  }

  console.log("Canonicalized Body:\n", result);

  const digest = crypto.createHash('sha256').update(result).digest('base64');
  console.log("\nCalculated DigestValue:", digest);
  console.log("Expected DigestValue:   oy8CVTieH1EkIXIDeZO2uF+qcKPcutomR7MkOw0u0QU=");
});
