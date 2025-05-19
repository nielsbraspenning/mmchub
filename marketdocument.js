const { create } = require('xmlbuilder2');
//const { DateTime } = require('luxon');
const { SignedXml } = require('xml-crypto');
const xpath = require('xpath');

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const { v4: uuidv4 } = require('uuid');
const uuid = uuidv4();
const forge = require('node-forge');
const crypto = require('crypto');
const { ExclusiveCanonicalization } = require('xml-crypto').SignedXml;
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');




const signature_id = uuidv4();
const reference_uri = uuidv4();
const keyinfo_id = uuidv4();
const other_id = uuidv4();

const privateKey = fs.readFileSync('./sign-cert/smime-staging/smime-covolt-key_staging.key', 'utf8');
const certificate = fs.readFileSync('./sign-cert/smime-staging/service-nl_covolt_eu.crt', 'utf8');


const cert = forge.pki.certificateFromPem(certificate);

const skiExt = cert.getExtension('subjectKeyIdentifier');
console.log(skiExt)
let skiBase64 = Buffer.from(skiExt.subjectKeyIdentifier, 'hex').toString('base64');
skiBase64 = 'uBNiKsepOdnEocxddcYPofPwi8Q='
console.log(skiBase64)


const keyInfoBlock = `
<dsig:KeyInfo Id="${keyinfo_id}">
  <wsse:SecurityTokenReference 
      xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" wsu:Id="${other_id}">
    <wsse:KeyIdentifier
        EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary"
      ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509SubjectKeyIdentifier">
      ${skiBase64}
    </wsse:KeyIdentifier>
  </wsse:SecurityTokenReference>
</dsig:KeyInfo>`;




const endpoint = 'http://localhost:8081/AncillaryServices/EnergyAccount/v1.0'; // Het endpoint van TenneT
const namespace = 'http://sys.svc.tennet.nl/AncillaryServices/';



function generatePoints(startLocal,stopLocal,intervalSeconds) {
  const points = [];

  const tz = 'Europe/Amsterdam';
  const startMoment = moment.tz(startLocal, tz);
  const eindMoment = moment.tz(stopLocal, tz);
  
  const duurInMilliseconden = eindMoment.valueOf() - startMoment.valueOf();
  const duurInUren = duurInMilliseconden / (1000 * 60 * 60);


 //const numPoints = (duurInUren * 60 * 60) / intervalSeconds
 const numPoints = 10
//    let currentUTC = DateTime.fromISO(utcStart, { zone: 'utc' });
//  
  for (let i = 1; i <= numPoints; i++) {
   //const raw = (Math.random() * 2 - 1) * 1_000_000;
    const raw = Math.random() * 999.999999;
    const formatNumber = (num) => Math.abs(num).toFixed(6);
  
    const point = {
      position: i,
   //  timestamp: currentUTC.toISO(),
      out: raw >= 0 ? formatNumber(raw) : "0.000000",
      in: raw < 0 ?  formatNumber(raw)  : "0.000000"
    };
  
    points.push(point);
//      currentUTC = currentUTC.plus({ seconds: intervalSeconds });
  }
//  
  return points;
}


function buildEnergyAccountXML(params) {
  const {
    mRID, revisionNumber, senderId, receiverId,
    createdDateTime, periodStart, periodEnd,
    timeSeriesId, product, marketEvaluationPointId, sampleInterval
  } = params;

  const createdDateTimeUtc = moment.tz(createdDateTime, 'Europe/Amsterdam').utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
  const periodStartUtc = moment.tz(periodStart, 'Europe/Amsterdam').utc().format('YYYY-MM-DDTHH:mm[Z]');
  const periodEndUtc = moment.tz(periodEnd, 'Europe/Amsterdam').utc().format('YYYY-MM-DDTHH:mm[Z]');

  const points = generatePoints(periodStart, periodEnd, sampleInterval);

  // ⬇️ Directly start with EnergyAccount_MarketDocument as root
  const doc = create().ele('EnergyAccount_MarketDocument', {
    xmlns: 'urn:iec62325.351:tc57wg16:451-4:energyaccountdocument:4:0'
  });

  doc.ele('mRID').txt(mRID).up();
  doc.ele('revisionNumber').txt(revisionNumber).up();
  doc.ele('type').txt('A45').up()
  doc.ele('docStatus')
    .ele('value').txt('A07').up()
  .up()
  doc.ele('process.processType').txt('A28').up();
  doc.ele('process.classificationType').txt('A02').up();
  doc.ele('sender_MarketParticipant.mRID', { codingScheme: 'A01' }).txt(senderId).up();
  doc.ele('sender_MarketParticipant.marketRole.type').txt('A12').up();
  doc.ele('receiver_MarketParticipant.mRID', { codingScheme: 'A01' }).txt(receiverId).up();
  doc.ele('receiver_MarketParticipant.marketRole.type').txt('A04').up();
  doc.ele('createdDateTime').txt(createdDateTimeUtc).up();
  doc.ele('period.timeInterval')
    .ele('start').txt(periodStartUtc).up()
    .ele('end').txt(periodEndUtc).up()
  .up();
  //doc.ele('domain.mRID', { codingScheme: 'A01' }).txt('10YNL----------L').up();

  const ts = doc.ele('TimeSeries');
  ts.ele('mRID').txt(timeSeriesId).up();
  ts.ele('businessType').txt('A11').up();
  ts.ele('product').txt(product).up();
  ts.ele('objectAggregation').txt('A02').up();
  ts.ele('area_Domain.mRID', { codingScheme: 'A01' }).txt('10YNL----------L').up();
  ts.ele('measure_Unit.name').txt('MAW').up();
  ts.ele('currency_Unit.name').txt('EUR').up();
  ts.ele('marketEvaluationPoint.mRID', { codingScheme: 'A01'}).txt(marketEvaluationPointId).up();     //checking coding scheme

  const period = ts.ele('Period');

  period.ele('timeInterval')
      .ele('start').txt(periodStartUtc).up()
      .ele('end').txt(periodEndUtc).up()
  .up()

  period.ele('resolution').txt('PT' +  sampleInterval + 'S').up()

  points.forEach(p => {
    period.ele('Point')
        .ele('position').txt(p.position).up()
        .ele('in_Quantity.quantity').txt(p.in).up()
        .ele('out_Quantity.quantity').txt(p.out).up()
    .up();
  });

  return doc;  // Return the XMLBuilder instance
}


function buildUnsignedSOAP(bodyXmlBuilder, certificate) {
  //const uuid = 'uuid-' + Math.random().toString(36).substring(2, 15);

  // Create root document
  const doc = create({ version: '1.0', encoding: 'UTF-8' });

  // Build Envelope
  const envelope = doc.ele('soapenv:Envelope', {
    'xmlns:soapenv': 'http://schemas.xmlsoap.org/soap/envelope/'
  });

  const header = envelope.ele('soapenv:Header');

  const messageHeader = header.ele('MessageAddressing',{
    'xmlns' : 'http://sys.svc.tennet.nl/MMCHub/Header/v1'
  });
  
  messageHeader.ele('technicalMessageId').txt(uuid);
  messageHeader.ele('correlationId').txt(uuid);
  messageHeader.ele('senderId').txt('8719333027500');
  messageHeader.ele('receiverId').txt('8716867999983');
  messageHeader.ele('carrierId').txt('8719333027500');
  messageHeader.ele('contentType').txt('ACTIVATED_FCR');

  const security = header.ele('wsse:Security', { 
    'xmlns:wsse' : 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd',
		'xmlns:soap' : 'http://schemas.xmlsoap.org/soap/envelope/',
    'soap:mustUnderstand': '1'
  });



  const body = envelope.ele('soapenv:Body', { 'xmlns:wsu' :'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd', 'wsu:Id': reference_uri });
  body.import(bodyXmlBuilder);

  // ✅ Now call .end() on the root document
  return doc.end({ prettyPrint: true });
}




async function sendEnergyAccount() {
  const bodyXmlBuilder = buildEnergyAccountXML({
    mRID: 'DOC-FCR-20250514-0001',                            //blijf gelijk
    revisionNumber: 1,                                        //bij updates moet dit veranderen
    senderId: '8719333027500',                                //covolt ean
    receiverId: '8716867999983',
    createdDateTime: '2025-05-14T14:00:00',                   //moment waarop document gegenereerd is, lokale tijd
    sampleInterval : 1,                                       //1
    periodStart: '2025-05-15T00:00:00',                       //start van fcr blokken, lokale tijd
    periodEnd: '2025-05-16T04:00:00',                         //einde van fcr blokken, lokale tijd
    timeSeriesId: 'TS-20250514-01',
    product: '8716867000016',
    marketEvaluationPointId: '871687910000500037'
  });

  const unsignedXml = buildUnsignedSOAP(bodyXmlBuilder, certificate);
  //const unsignedXml = unsignedSoapBuilder.end({ prettyPrint: true });



  const sig = new SignedXml({
    privateKey,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
  });


  sig.addReference({
    xpath: "//*[local-name(.)='Body']",
    transforms: ['http://www.w3.org/2001/10/xml-exc-c14n#'],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256'
  });


  sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';


  sig.keyInfoProvider = {
    getKeyInfo: () => `
      <wsse:SecurityTokenReference xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
        <wsse:Reference URI="#X509Token"
          ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" />
      </wsse:SecurityTokenReference>`
  };

 //sig.computeSignature(unsignedXml);
 // const signedXml = sig.getSignedXml();
 //sig.signatureId = "G146c3de7-2534-41c5-828b-642367ce7201";

 sig.computeSignature(unsignedXml, {
  prefix: "dsig",
  location: {
    reference: "//*[local-name(.)='Security']",
    action: 'append'
  }
});
let signedXml = sig.getSignedXml();

signedXml = signedXml.replace(
  '<dsig:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>',
  `<dsig:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#">
     <c14nEx:InclusiveNamespaces xmlns:c14nEx="http://www.w3.org/2001/10/xml-exc-c14n#" PrefixList="soapenv"/>
   </dsig:CanonicalizationMethod>`
);

signedXml = signedXml.replace(
'<dsig:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>','<dsig:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"><c14nEx:InclusiveNamespaces xmlns:c14nEx="http://www.w3.org/2001/10/xml-exc-c14n#" PrefixList=""/></dsig:Transform>'
);

signedXml = signedXml.replace(
  '</dsig:SignatureValue>',
  '</dsig:SignatureValue>' + keyInfoBlock
);

//fs.writeFileSync('outgoing_soap.xml', signedXml, 'utf8');

//Retrieved info

// ➡️ Gebruik jouw bestaande signedXml string (na .replace)
const doc = new DOMParser().parseFromString(signedXml, 'application/xml');

// 🔎 XPath met correcte prefix
const select = xpath.useNamespaces({
  dsig: 'http://www.w3.org/2000/09/xmldsig#'
});

// Zoek het <dsig:SignedInfo>-element
const signedInfoNode = select('//dsig:SignedInfo', doc)[0];
if (!signedInfoNode) {
  throw new Error('❌ Geen <dsig:SignedInfo> gevonden');
}

// Zet het om naar string en toon in console
const signedInfoString = new XMLSerializer().serializeToString(signedInfoNode);
console.log('📦 Stap 1: Extracted <dsig:SignedInfo>:\n', signedInfoString);

const canon = canonicalizeXml(signedInfoString);
console.log('🔒 Canonicalized XML:\n', canon);

fs.writeFileSync('canonicalized.xml', canon, 'utf8');


const signer = crypto.createSign('RSA-SHA256');
signer.update(canon);
signer.end();

const signatureValue = signer.sign(privateKey, 'base64');

// ✅ Output
console.log('✅ SignatureValue:\n', signatureValue);

//signedXml = signedXml.replace(
//  '<dsig:SignatureValue>',
//  '<dsig:SignatureValue>' + signatureValue
//);

//fs.writeFileSync('final-outgoing_soap.xml', signedXml, 'utf8');

const signedXmlWithWrongSignatureValue = new DOMParser().parseFromString(signedXml, 'application/xml');


// 4. Vervang de oude SignatureValue node
const signatureValueNode = select('//dsig:SignatureValue', signedXmlWithWrongSignatureValue)[0];
if (!signatureValueNode) throw new Error('⚠️ Geen <SignatureValue> gevonden');

signatureValueNode.textContent = signatureValue;

// 5. Schrijf naar bestand (of console.log als je wilt inspecteren)
const updatedXml = new XMLSerializer().serializeToString(signedXmlWithWrongSignatureValue);
fs.writeFileSync('transmitted_soap_message.xml', updatedXml, 'utf8');
console.log('✅ Nieuwe SignatureValue succesvol toegevoegd!');



  try {
    const response = await axios.post(endpoint, updatedXml, {
      headers: {
        'Content-Type': 'text/xml',
        'SOAPAction': 'http://sys.svc.tennet.nl/AncillaryServices/sendEnergyAccount'
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    console.log('✅ Raw Response:\n', response.data);
    handleResponse(response.data);

  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.response) {
      console.error('❌ Response:', err.response.data);
      handleResponse(err.response.data);
    }
  }
}

function handleResponse(xmlResponse) {
  const doc = new DOMParser().parseFromString(xmlResponse);
  const select = xpath.useNamespaces({
    soap11: 'http://schemas.xmlsoap.org/soap/envelope/',
    hub: 'http://sys.svc.tennet.nl/AncillaryServices/v1'
  });

  const faultNode = select('//soap11:Fault', doc);
  if (faultNode.length > 0) {
    const faultCode = select('string(//soap11:Fault/faultcode)', doc);
    const faultString = select('string(//soap11:Fault/faultstring)', doc);
    console.error(`❌ SOAP Fault ontvangen:\nCode: ${faultCode}\nMelding: ${faultString}`);
    return;
  }

  const statusNode = select('//hub:EnergyAccount_MarketDocumentResponse', doc);
  if (statusNode.length > 0) {
    const statusText = statusNode[0].firstChild.data;
    console.log(`✅ EnergyAccount_MarketDocumentResponse ontvangen. Status: ${statusText}`);
  } else {
    console.warn('⚠️ Onbekende response ontvangen!');
  }
}


//async function calculateSignature(signedXmlStr){
//    // Parse XML
//  const doc = new DOMParser().parseFromString(signedXmlStr,'application/xml');
//  const select = xpath.useNamespaces({
//    dsig: 'http://www.w3.org/2000/09/xmldsig#'
//  });
//
//  // Zoek het SignedInfo-element
//  const signedInfoNode = select('//ds:SignedInfo', doc)[0];
//  if (!signedInfoNode) throw new Error('Geen <SignedInfo> gevonden');
//
//  // Canonicaliseer met exclusive c14n
//  const canonizedSignedInfo = new SignedXml().getCanonXml(
//    signedInfoNode,
//    { inclusiveNamespacesPrefixList: '' } // pas aan indien nodig
//  );
//
//  // Genereer SignatureValue met private key
//  const signature = crypto.createSign('RSA-SHA256');
//  signature.update(canonizedSignedInfo);
//  signature.end();
//  const signatureValue = signature.sign(privateKey, 'base64');
//
//  console.log('✅ Nieuwe SignatureValue:\n', signatureValue);
//
//  // Vervang de oude SignatureValue
//  const signatureValueNode = select('//ds:SignatureValue', doc)[0];
//  if (!signatureValueNode) throw new Error('Geen <SignatureValue> gevonden');
//  signatureValueNode.textContent = signatureValue;
//
//  // Schrijf naar bestand
//  const updatedXml = new XMLSerializer().serializeToString(doc);
//  fs.writeFileSync('outgoing_soap_signed.xml', updatedXml, 'utf8');
//
//  console.log('📄 Handtekening bijgewerkt in outgoing_soap_signed.xml');
//}

function canonicalizeXml(xmlString) {
  return xmlString
    .replace(/\r?\n/g, '') // verwijder line breaks
    .replace(/>\s+</g, '><') // verwijder indenting
    .replace(/<!--[\s\S]*?-->/g, '') // verwijder comments
    .replace(/\s{2,}/g, ' ') // multiple spaces -> 1 space
    .trim();
}



sendEnergyAccount();