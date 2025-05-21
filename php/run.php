<?php

require __DIR__ . '/vendor/autoload.php';

use RobRichards\XMLSecLibs\XMLSecurityKey;
use RobRichards\WsePhp\WSSESoap;

// === CONFIG ===
$signingCert = __DIR__ . '/certs/smime-covolt-pub_staging.pem';
$signingKey  = __DIR__ . '/certs/smime-covolt-key_staging.key';

// === Dummy SOAP message ===
$request = <<<XML
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" wsu:Id="Body">
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
//$objWSSE->addTimestamp();

// === Load private key ===
$key = new XMLSecurityKey(XMLSecurityKey::RSA_SHA256, ['type' => 'private']);
$key->loadKey($signingKey, true);

// === Sign the SOAP message ===
$objWSSE->signSoapDoc($key);

// === Load certificate and attach as BinarySecurityToken ===
$certContent = file_get_contents($signingCert);
$token = $objWSSE->addBinaryToken($certContent);

// === Attach BinarySecurityToken using SubjectKeyIdentifier ===
$objWSSE->attachTokentoSig($token, false, true);


// === Load certificate and attach as BinarySecurityToken ===
//$certContent = file_get_contents($signingCert);
//$token = $objWSSE->addBinaryToken($certContent);
//
//// === Load private key ===
//$key = new XMLSecurityKey(XMLSecurityKey::RSA_SHA256, ['type' => 'private']);
//$key->loadKey($signingKey, true);
//
//// === Attach BinarySecurityToken to signature using SubjectKeyIdentifier ===
//$objWSSE->attachTokentoSig($token, false, true);  // false = geen Reference, true = gebruik SKI
//
//// === Sign the SOAP message ===
//$objWSSE->signSoapDoc($key);

// === Output signed XML ===
echo $objWSSE->saveXML();
