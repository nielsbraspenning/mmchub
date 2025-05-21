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

// === Load XML into DOM ===
$doc = new DOMDocument();
$doc->loadXML($request);

// === WSSE handler ===
$objWSSE = new WSSESoap($doc);
$objWSSE->addTimestamp();

// === Ensure Security node exists
if (!$objWSSE->securityNode) {
    $objWSSE->addSecurityHeader();
}

// === XPath helpers
$xpath = new DOMXPath($doc);
$xpath->registerNamespace("soapenv", "http://schemas.xmlsoap.org/soap/envelope/");
$xpath->registerNamespace("wsu", "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd");

// === Get Body and Timestamp nodes
$bodyNode = $xpath->query('//soapenv:Body')->item(0);
$timestampNode = $xpath->query('//wsu:Timestamp')->item(0);

// === Ensure IDs
$wsuNS = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd';

$bodyId = $bodyNode->getAttributeNS($wsuNS, 'Id') ?: 'Body';
if (!$bodyNode->hasAttributeNS($wsuNS, 'Id')) {
    $bodyNode->setAttributeNS($wsuNS, 'wsu:Id', $bodyId);
}

$timestampId = $timestampNode->getAttributeNS($wsuNS, 'Id');

// === Create XML Signature
$dsig = new XMLSecurityDSig();
$dsig->setCanonicalMethod(XMLSecurityDSig::EXC_C14N);

// ✅ Add references with SHA-256 (your original pattern reused here)
$dsig->addReference($bodyNode, XMLSecurityDSig::SHA256, ['http://www.w3.org/2001/10/xml-exc-c14n#'], ['uri' => '#' . $bodyId]);
$dsig->addReference($timestampNode, XMLSecurityDSig::SHA256, ['http://www.w3.org/2001/10/xml-exc-c14n#'], ['uri' => '#' . $timestampId]);

// === Load private key
$key = new XMLSecurityKey(XMLSecurityKey::RSA_SHA256, ['type' => 'private']);
$key->loadKey($signingKey, true);

// === Sign and append to wsse:Security
$dsig->sign($key);
$dsig->appendSignature($objWSSE->securityNode, true);

// === Add BinarySecurityToken (optional inline cert)
$certContent = file_get_contents($signingCert);
$token = $objWSSE->addBinaryToken($certContent);

// === Attach token using SubjectKeyIdentifier
$objWSSE->attachTokentoSig($token, false, true);

// === Output signed XML
echo $objWSSE->saveXML();
