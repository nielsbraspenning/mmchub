const { create } = require('xmlbuilder2');
//const { DateTime } = require('luxon');
const { SignedXml } = require('xml-crypto');
const axios = require('axios');
const fs = require('fs');
const moment = require('moment-timezone');
const { v4: uuidv4 } = require('uuid');
const uuid = uuidv4();



//opmerkingen begin
//<ns1:docStatus>
//<ns1:value>A07</ns1:value>
//</ns1:docStatus>
//
//<docStatus>A07</docStatus>
//
//--------------------------------
//<ns1:sender_MarketParticipant.mRID codingScheme="A10">0123456789123</ns1:sender_MarketParticipant.mRID>
//
//<sender_MarketParticipant.mRID codingScheme="A01">1234567890123</sender_MarketParticipant.mRID>
//---------------------------
//<ns1:receiver_MarketParticipant.mRID codingScheme="A10">8716867999983</ns1:receiver_MarketParticipant.mRID>
//
//<receiver_MarketParticipant.mRID codingScheme="A01">9876543210987</receiver_MarketParticipant.mRID>
//---------------------------
//<createdDateTime>2025-03-30T12:00:00Z</createdDateTime> --> vandaag gecreeerd, voor levering van gisteren
//<period.timeInterval>
//		<start>2025-03-30T00:00:00Z</start>
//		<end>2025-03-31T00:00:00Z</end>     dit tijdstip moet voor of gelijk zijn aan <createDatetime>
//</period.timeInterval>
//
//----------------------------------
//<domain.mRID codingScheme="A01">10YNL----------L</domain.mRID>
//
//?????
//-----------------------------
//<currency_Unit.name>EUR</currency_Unit.name>
//
//??????
//-------------------------
//<marketEvaluationPoint.mRID>123456789012345678</marketEvaluationPoint.mRID>
//
//<ns1:marketEvaluationPoint.mRID codingScheme="A10">012345678901234567</ns1:marketEvaluationPoint.mRID>
//-----------------------
//missend
//
//
//<ns1:Period>
//						<ns1:timeInterval>
//							<ns1:start>2018-04-18T00:00Z</ns1:start>
//							<ns1:end>2018-04-19T00:00Z</ns1:end>
//						</ns1:timeInterval>
//						<ns1:resolution>PT4S</ns1:resolution>
//						<ns1:Point>
//-------------------------------------------
//aantal punten, 
//
//<quantity>1.00</quantity>
//
//<ns1:in_Quantity.quantity>824</ns1:in_Quantity.quantity>
//<ns1:out_Quantity.quantity>6146</ns1:out_Quantity.quantity>
//------------------------------------
//


//opmerkingen einde






const privateKey = fs.readFileSync('./sign-cert/s-mimi-staging.key', 'utf8');
const certificate = fs.readFileSync('./sign-cert/service-nl_covolt_eu.crt', 'utf8');

const endpoint = 'http://localhost:8081/AncillaryServices/EnergyAccount/v1.0'; // Het endpoint van TenneT
const namespace = 'http://sys.svc.tennet.nl/AncillaryServices/';



function generatePoints(startLocal,stopLocal,intervalSeconds) {
  const points = [];

  const tz = 'Europe/Amsterdam';
  const startMoment = moment.tz(startLocal, tz);
  const eindMoment = moment.tz(stopLocal, tz);
  
  const duurInMilliseconden = eindMoment.valueOf() - startMoment.valueOf();
  const duurInUren = duurInMilliseconden / (1000 * 60 * 60);


  const numPoints = (duurInUren * 60 * 60) / intervalSeconds
 // const numPoints = 10
//    let currentUTC = DateTime.fromISO(utcStart, { zone: 'utc' });
//  
  for (let i = 1; i <= numPoints; i++) {
    const raw = (Math.random() * 2 - 1) * 1_000_000;
  
    const point = {
      position: i,
   //  timestamp: currentUTC.toISO(),
      out: raw >= 0 ? raw.toFixed(6) : "0.000000",
      in: raw < 0 ? Math.abs(raw).toFixed(6) : "0.000000"
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
    timeSeriesId, product, marketEvaluationPointId,sampleInterval
  } = params;

  const createdDateTimeUtc = moment.tz(createdDateTime, 'Europe/Amsterdam').utc().format();
  const periodStartUtc = moment.tz(periodStart, 'Europe/Amsterdam').utc().format();
  const periodEndUtc = moment.tz(periodEnd, 'Europe/Amsterdam').utc().format();

  const namespace = 'http://sys.svc.tennet.nl/AncillaryServices/';
  const points = generatePoints(periodStart, periodEnd, sampleInterval);

  const root = create().ele('hub:sendEnergyAccount', { xmlns: namespace });
  const doc = root.ele('EnergyAccount_MarketDocument', {
    xmlns: 'urn:iec62325.351:tc57wg16:451-4:energyaccountingdocument:1:0'
  });

  doc.ele('mRID').txt(mRID).up();
  doc.ele('revisionNumber').txt(revisionNumber).up();
  doc.ele('type').txt('A45').up();
  doc.ele('docStatus').txt('A07').up();
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
  doc.ele('domain.mRID', { codingScheme: 'A01' }).txt('10YNL----------L').up();

  const ts = doc.ele('TimeSeries');
  ts.ele('mRID').txt(timeSeriesId).up();
  ts.ele('businessType').txt('A11').up();
  ts.ele('product').txt(product).up();
  ts.ele('objectAggregation').txt('A02').up();
  ts.ele('area_Domain.mRID', { codingScheme: 'A01' }).txt('10YNL----------L').up();
  ts.ele('measure_Unit.name').txt('MAW').up();
  ts.ele('currency_Unit.name').txt('EUR').up();
  ts.ele('marketEvaluationPoint.mRID').txt(marketEvaluationPointId).up();

  points.forEach(p => {
    ts.ele('Point')
        .ele('in_position').txt(p.position).up()
      .ele('in_Quantity.quantity').txt(p.in).up()
      .ele('out_Quantity.quantity').txt(p.out).up()
    .up();
  });

  return root; // XMLBuilder instance (geen .end())
}

function buildUnsignedSOAP(bodyXmlBuilder, certificate) {
  const uuid = 'uuid-' + Math.random().toString(36).substring(2, 15);

  // Create root document
  const doc = create({ version: '1.0', encoding: 'UTF-8' });

  // Build Envelope
  const envelope = doc.ele('soapenv:Envelope', {
    'xmlns:soapenv': 'http://schemas.xmlsoap.org/soap/envelope/',
    'xmlns:hub': 'http://sys.svc.tennet.nl/AncillaryServices/',
    'xmlns:wsse': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd',
    'xmlns:wsu': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd'
  });

  const header = envelope.ele('soapenv:Header');

  const security = header.ele('wsse:Security', { 'soapenv:mustUnderstand': '1' });
  security.ele('wsse:BinarySecurityToken', {
    EncodingType: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary',
    ValueType: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3',
    'wsu:Id': 'X509Token'
  }).txt(certificate.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, ''));

  const messageHeader = header.ele('hub:MessageHeader');
  messageHeader.ele('hub:TechnicalMessageID').txt(uuid);
  messageHeader.ele('hub:CorrelationID').txt(uuid);
  messageHeader.ele('hub:SenderID').txt('8719333027500');
  messageHeader.ele('hub:ReceiverID').txt('9876543210987');
  messageHeader.ele('hub:CarrierID').txt('DEFAULT');
  messageHeader.ele('hub:ContentType').txt('application/energyaccount+xml');

  const body = envelope.ele('soapenv:Body', { 'wsu:Id': 'Body' });
  body.import(bodyXmlBuilder);

  // ✅ Now call .end() on the root document
  return doc.end({ prettyPrint: true });
}




async function sendEnergyAccount() {
  const bodyXmlBuilder = buildEnergyAccountXML({
    mRID: 'DOC-FCR-20250330-0001',                            //blijf gelijk
    revisionNumber: 1,                                        //bij updates moet dit veranderen
    senderId: '1234567890123',
    receiverId: '9876543210987',
    createdDateTime: '2025-04-18T12:50:00',                   //moment waarop document gegenereerd is, lokale tijd
    sampleInterval : 1,                                       //1
    periodStart: '2025-04-17T00:00:00',                       //start van fcr blokken, lokale tijd
    periodEnd: '2025-04-17T04:00:00',                         //einde van fcr blokken, lokale tijd
    timeSeriesId: 'TS-20250330-01',
    product: '8716867000016',
    marketEvaluationPointId: '123456789012345678'
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
 sig.computeSignature(unsignedXml, {
  location: {
    reference: "//*[local-name(.)='Security']",
    action: 'append'
  }
});
const signedXml = sig.getSignedXml();
  console.log('Signed SOAP XML:\n', signedXml);


  try {
    const response = await axios.post(endpoint, signedXml, {
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

  const statusNode = select('//hub:EnergyAccount_MarketDocumentResponse', doc);
  if (statusNode.length > 0) {
    const statusText = statusNode[0].firstChild.data;
    console.log(`✅ EnergyAccount_MarketDocumentResponse ontvangen. Status: ${statusText}`);
  } else {
    console.warn('⚠️ Onbekende response ontvangen!');
  }
}


sendEnergyAccount();

