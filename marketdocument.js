const { create } = require('xmlbuilder2');
//const { DateTime } = require('luxon');
const { SignedXml } = require('xml-crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const { v4: uuidv4 } = require('uuid');
const uuid = uuidv4();
const forge = require('node-forge');
const crypto = require('crypto');
const { DOMParser } = require('@xmldom/xmldom');
const { ExclusiveCanonicalization } = require('xml-crypto').SignedXml;

const signature_id = uuidv4();
const reference_uri = 'id-' + uuidv4();

const privateKey = fs.readFileSync('./sign-cert/s-mimi-staging.key', 'utf8');
const certificate = fs.readFileSync('./sign-cert/service-nl_covolt_eu.crt', 'utf8');

//const derCert = pemToDer(certificate);
//
//const thumbprint = crypto
//  .createHash('sha1')
//  .update(derCert)
//  .digest('base64');

//console.log('Base64 SHA-1 Thumbprint:', thumbprint);

//const sign = crypto.createSign('RSA-SHA256');

// Update the Sign object with the canonicalized SignedInfo
//sign.update(canonicalizedSignedInfo);
//sign.end();

// Generate the signature in base64 format
//const signatureValue = sign.sign(privateKey, 'base64');


const keyInfoBlock = `
<ds:KeyInfo Id="361aed54edtr4d3346a">
  <wsse:SecurityTokenReference wsu:Id="ahsh47dtwgs78w2w9sjdjee238">
    <wsse:KeyIdentifier
      ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509SubjectKeyIdentifier"
      EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">
      testsignature
    </wsse:KeyIdentifier>
  </wsse:SecurityTokenReference>
</ds:KeyInfo>
`;




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



  //points.forEach(p => {
  //  ts.ele('Point')
  //      .ele('in_position').txt(p.position).up()
  //      .ele('in_Quantity.quantity').txt(p.in).up()
  //      .ele('out_Quantity.quantity').txt(p.out).up()
  //  .up();
  //});

  return doc;  // Return the XMLBuilder instance
}


function buildUnsignedSOAP(bodyXmlBuilder, certificate) {
  //const uuid = 'uuid-' + Math.random().toString(36).substring(2, 15);

  // Create root document
  const doc = create({ version: '1.0', encoding: 'UTF-8' });

  // Build Envelope
  const envelope = doc.ele('soap11:Envelope', {
     'xmlns:header': 'http://sys.svc.tennet.nl/MMCHub/Header/v1',
    'xmlns:soap11': 'http://schemas.xmlsoap.org/soap/envelope/'
    //'xmlns:hub': 'http://sys.svc.tennet.nl/AncillaryServices/',
    //'xmlns:wsse': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd',
    //'xmlns:wsu': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd',
   

  });

  const header = envelope.ele('soap11:Header');

  const security = header.ele('wsse:Security', { 
      'soap11:mustUnderstand': '1', 
      'xmlns:wsu': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd',
      'xmlns:wsse': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd'    
    });
  security.ele('wsse:BinarySecurityToken', {
    EncodingType: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary',
    ValueType: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3',
    'wsu:Id': 'X509Token'
  }).txt(certificate.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, ''));

  

  const messageHeader = header.ele('header:MessageAddressing',{
    'xmlns:xsi'     : 'http://www.w3.org/2001/XMLSchema-instance',
    'xmlns:xs'      :'http://www.w3.org/2001/XMLSchema',
    'xmlns:wsu'     :'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd',
    'xmlns:wsse'    :'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd',
    'xmlns:tsm'     :'http://tennet.eu/cdm/tennet/TennetService/Message/v2.0',
    'xmlns:tns0'    :'http://tennet.eu/cdm/tennet/v1.0',
    'xmlns:tns'     :'http://sys.svc.tennet.nl/AncillaryServices',
    'xmlns:tas'     :'http://sys.svc.tennet.nl/AncillaryServices/v1',
    'xmlns:ead'     :'urn:iec62325.351:tc57wg16:451-4:energyaccountdocument:4:0',
    'xmlns:common'  :'http://sys.svc.tennet.nl/MMCHub/common/v1',
    'xmlns:cl'      :'urn:entsoe.eu:wgedi:codelists'
  });
  messageHeader.ele('header:technicalMessageId').txt(uuid);
  messageHeader.ele('header:correlationId').txt(uuid);
  messageHeader.ele('header:senderId').txt('8719333027500');
  messageHeader.ele('header:receiverId').txt('8716867999983');
  messageHeader.ele('header:carrierId').txt('8719333027500');
  messageHeader.ele('header:contentType').txt('ACTIVATED_FCR');

  const body = envelope.ele('soap11:Body', { 'xmlns:wsu' :'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd', 'wsu:Id': reference_uri });
  body.import(bodyXmlBuilder);

  // ✅ Now call .end() on the root document
  return doc.end({ prettyPrint: true });
}




async function sendEnergyAccount() {
  const bodyXmlBuilder = buildEnergyAccountXML({
    mRID: 'DOC-FCR-20250340-0001',                            //blijf gelijk
    revisionNumber: 1,                                        //bij updates moet dit veranderen
    senderId: '8719333027500',                                //covolt ean
    receiverId: '8716867999983',
    createdDateTime: '2025-04-25T09:40:00',                   //moment waarop document gegenereerd is, lokale tijd
    sampleInterval : 1,                                       //1
    periodStart: '2025-04-24T00:00:00',                       //start van fcr blokken, lokale tijd
    periodEnd: '2025-04-24T04:00:00',                         //einde van fcr blokken, lokale tijd
    timeSeriesId: 'TS-20250340-01',
    product: '8716867000016',
    marketEvaluationPointId: '871687910000500037'
  });

  //const unsignedXml = buildUnsignedSOAP(bodyXmlBuilder, certificate);
  const signedXml =  buildUnsignedSOAP(bodyXmlBuilder, certificate);
  //const unsignedXml = unsignedSoapBuilder.end({ prettyPrint: true });



 // const sig = new SignedXml({
 //   privateKey,
 //   signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
 // });
//
//
 // sig.addReference({
 //   xpath: "//*[local-name(.)='Body']",
 //   transforms: ['http://www.w3.org/2001/10/xml-exc-c14n#'],
 //   digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256'
 // });
//
//
 // sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';
//
//
 // sig.keyInfoProvider = {
 //   getKeyInfo: () => `
 //     <wsse:SecurityTokenReference xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
 //       <wsse:Reference URI="#X509Token"
 //         ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" />
 //     </wsse:SecurityTokenReference>`
 // };

 //sig.computeSignature(unsignedXml);
 // const signedXml = sig.getSignedXml();
 //sig.computeSignature(unsignedXml, {
 // prefix: "ds",
 // location: {
 //   reference: "//*[local-name(.)='Security']",
 //   action: 'append'
 // }
//});
//let signedXml = sig.getSignedXml();
//signedXml = signedXml.replace('<ds:Signature', '<ds:Signature Id="' +  signature_id + '"');
//signedXml = signedXml.replace('</ds:SignatureValue>', '</ds:SignatureValue>' + keyInfoBlock);
//signedXml = signedXml.replace('<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>',  '<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"><ec:InclusiveNamespaces PrefixList="header soap11" xmlns:ec="http://www.w3.org/2001/10/xml-exc-c14n#" /></ds:CanonicalizationMethod>');
//signedXml = signedXml.replace('<ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>','<ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"> <ec:InclusiveNamespaces PrefixList="header" xmlns:ec="http://www.w3.org/2001/10/xml-exc-c14n#"/> </ds:Transform>');
//signedXml = signedXml.replace('<ds:DigestValue>w35gFl85eumJBCJSBvBCYZX4ZbfHdONwP1blVIcHdic=</ds:DigestValue>', '<ds:DigestValue>d/9PnDY3zXtnummgfkB8AUYrk/AmiiWOhKTZEGzXFLI=</ds:DigestValue>');

console.log(signedXml)

// Replace 'your-xml-file.xml' with the path to your XML file
const xmlFilePath = path.join(__dirname, signedXml);
const fileXml = fs.readFileSync(xmlFilePath, 'utf8');


  try {
    const response = await axios.post(endpoint, fileXml, {
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


sendEnergyAccount();

