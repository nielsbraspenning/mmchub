//endpoints, test, aan de kant van tennet
//https://sys.acc.svc.tennet.nl/AncillaryServices/EnergyAccount/v1.0
//https://sys.acc.svc.tennet.nl/AncillaryServices/IsAlive/v1.0

//endpoint production aan de kant van tennet
//https://sys.svc.tennet.nl/AncillaryServices/EnergyAccount/v1.0
//https://sys.svc.tennet.nl/AncillaryServices/IsAlive/v1.0

//endpoint test aan de kant van covolt
//https://api-tennet-staging.covolt.eu/mmcHub/Response/Acknowledgement/v1.0
//https://api-tennet-staging.covolt.eu/mmcHub/Response/IsAlive/v1.0

//endpoint productie aan de kant van covolt
//https://api-tennet.covolt.eu/mmcHub/Response/Acknowledgement/v1.0
//https://api-tennet.covolt.eu/mmcHub/Response/IsAlive/v1.0


const axios = require('axios');
const { create } = require('xmlbuilder2');
const { SignedXml } = require('xml-crypto');
const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');
const xpath = require('xpath');

// Certificaten & Private Key (jouw bestanden)
const privateKey = fs.readFileSync('./sign-cert/s-mimi-staging.key', 'utf8');
const certificate = fs.readFileSync('./sign-cert/service-nl_covolt_eu.crt', 'utf8');

// Nieuwe endpoint & namespaces volgens de update WSDL
const endpoint = 'https://sys.acc.svc.tennet.nl/AncillaryServices/IsAlive/v1.0';  // Pas dit aan!
const namespace = 'http://sys.svc.tennet.nl/AncillaryServices/v1'; // Nieuw namespace

async function sendIsAlive() {
  // 1. Bouw de SOAP-body
  const xmlBody = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('soapenv:Envelope', {
      'xmlns:soapenv': 'http://schemas.xmlsoap.org/soap/envelope/',
      'xmlns:hub': namespace,
      'xmlns:wsse': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd',
      'xmlns:wsu': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd'
    })
    .ele('soapenv:Header')
    .ele('wsse:Security', { 'soapenv:mustUnderstand': '1' })
    .ele('wsse:BinarySecurityToken', {
      'EncodingType': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary',
      'ValueType': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3',
      'wsu:Id': 'X509Token'
    })
    .txt(certificate.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, ''))
    .up().up().up()
    .ele('soapenv:Body', { 'wsu:Id': 'Body' })
    .ele('hub:isAliveRequest')
    .up().up().up()
    .end({ prettyPrint: true });

  console.log('Unsigned SOAP XML:\n', xmlBody);

    //test
    const sig = new SignedXml({
        privateKey: privateKey,
        signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"
      });
      
      // Add a reference to the Body, with canonicalization + digest algorithms
      sig.addReference({
        xpath: "//*[local-name(.)='Body']",
        transforms: ["http://www.w3.org/2001/10/xml-exc-c14n#"],
        digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256"
      });
      
      // Set canonicalization algorithm globally (optional but recommended)
      sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
      
      // Provide the KeyInfo (SecurityTokenReference for WS-Security)
      sig.keyInfoProvider = {
        getKeyInfo: () => `
          <wsse:SecurityTokenReference xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
            <wsse:Reference URI="#X509Token"
              ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" />
          </wsse:SecurityTokenReference>`
      };

  sig.computeSignature(xmlBody);
//
  const signedXml = sig.getSignedXml();
//
  console.log('Signed SOAP XML:\n', signedXml);

  // 3. Verstuur het SOAP bericht via axios naar NGINX ➡️ TenneT
  try {
    const response = await axios.post(endpoint, signedXml, {
      headers: {
        'Content-Type': 'text/xml',
        'SOAPAction': 'http://sys.svc.tennet.nl/AncillaryServices/isAlive'
      },
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false // Alleen voor testen!
      })
    });

    console.log('Raw Response:\n', response.data);
    handleResponse(response.data);

  } catch (error) {
    console.error('HTTP Error:', error.message);
    if (error.response) {
      console.error('HTTP Response Data:', error.response.data);
      handleResponse(error.response.data);
    }
  }
}

function handleResponse(xmlResponse) {
  const doc = new DOMParser().parseFromString(xmlResponse);
  const select = xpath.useNamespaces({
    soapenv: 'http://schemas.xmlsoap.org/soap/envelope/',
    hub: 'http://sys.svc.tennet.nl/AncillaryServices/v1'
  });

  const faultNode = select('//soapenv:Fault', doc);
  if (faultNode.length > 0) {
    const faultCode = select('string(//soapenv:Fault/faultcode)', doc);
    const faultString = select('string(//soapenv:Fault/faultstring)', doc);
    console.error(`❌ SOAP Fault ontvangen:\nCode: ${faultCode}\nMelding: ${faultString}`);
    return;
  }

  const statusNode = select('//hub:isAliveResponse/hub:status', doc);
  if (statusNode.length > 0) {
    const statusText = statusNode[0].firstChild.data;
    console.log(`✅ isAliveResponse ontvangen. Status: ${statusText}`);
  } else {
    console.warn('⚠️ Onbekende response ontvangen!');
  }
}

sendIsAlive();

