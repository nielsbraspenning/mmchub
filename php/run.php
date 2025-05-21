<?php

require __DIR__ . '/vendor/autoload.php';

use RobRichards\XMLSecLibs\XMLSecurityKey;
use RobRichards\XMLSecLibs\XMLSecurityDSig;
use RobRichards\WsePhp\WSSESoap;

// === CONFIG ===
$signingCert = __DIR__ . '/certs/smime-covolt-pub_staging.pem';
$signingKey  = __DIR__ . '/certs/smime-covolt-key_staging.key';

// === Dummy SOAP message ===
$request = <<<XML
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>
    <MessageAddressing xmlns="http://sys.svc.tennet.nl/MMCHub/Header/v1">
      <technicalMessageId>ee1a1b0a-ec89-446a-91aa-15abc0fd4b7a</technicalMessageId>
      <correlationId>ee1a1b0a-ec89-446a-91aa-15abc0fd4b7a</correlationId>
      <senderId>8719333027500</senderId>
      <receiverId>8716867999983</receiverId>
      <carrierId>8719333027500</carrierId>
      <contentType>ACTIVATED_FCR</contentType>
    </MessageAddressing>
  </soapenv:Header>
  <soapenv:Body xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
    <example:Hello xmlns:example="http://example.com">
      <example:Name>Test</example:Name>
    </example:Hello>
  </soapenv:Body>
</soapenv:Envelope>
XML;

// === Load into DOMDocument ===
$doc = new DOMDocument();
$doc->loadXML($request);

// === WSSE handler ===
$objWSSE = new WSSESoap($doc);
$objWSSE->addTimestamp();

// === Load private key ===
$key = new XMLSecurityKey(XMLSecurityKey::RSA_SHA256, ['type' => 'private']);
$key->loadKey($signingKey, true);

// === Sign the SOAP message (returns the ds:Signature object) ===
$dsig = $objWSSE->signSoapDoc($key);

// === Set SHA256 digest explicitly for Body and Timestamp ===
$xpath = new DOMXPath($doc);
$xpath->registerNamespace("soapenv", "http://schemas.xmlsoap.org/soap/envelope/");
$xpath->registerNamespace("wsu", "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd");

// Get Body node and its wsu:Id
$bodyNode = $xpath->query('//soapenv:Body')->item(0);
$bodyId = $bodyNode->getAttributeNS('http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd', 'Id');

// If no wsu:Id was set, set one now
if (!$bodyId) {
    $bodyId = 'Body';
    $bodyNode->setAttributeNS('http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd', 'wsu:Id', $bodyId);
}

$dsig->addReference(
    $bodyNode,
    XMLSecurityDSig::SHA256,
    ['http://www.w3.org/2001/10/xml-exc-c14n#'],
    ['uri' => '#' . $bodyId]
);

// Get Timestamp node and its wsu:Id
$timestampNode = $xpath->query('//wsu:Timestamp')->item(0);
$timestampId = $timestampNode->getAttributeNS('http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd', 'Id');

$dsig->addReference(
    $timestampNode,
    XMLSecurityDSig::SHA256,
    ['http://www.w3.org/2001/10/xml-exc-c14n#'],
    ['uri' => '#' . $timestampId]
);

// === Load certificate and attach as BinarySecurityToken ===
$certContent = file_get_contents($signingCert);
$token = $objWSSE->addBinaryToken($certContent);

// === Attach BinarySecurityToken using SubjectKeyIdentifier ===
$objWSSE->attachTokentoSig($token, false, true);

// === Output signed XML ===
echo $objWSSE->saveXML();
