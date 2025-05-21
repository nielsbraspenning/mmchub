<?php

require __DIR__ . '/vendor/autoload.php';

use RobRichards\XMLSecLibs\XMLSecurityKey;
use RobRichards\WsePhp\WSSESoap;

$wsdl = __DIR__ . '/wsdl/your.wsdl';
$options = ['trace' => 1, 'exceptions' => true];
$signingCert = __DIR__ . '/certs/smime-covolt-pub_staging.pem';
$signingKey = __DIR__ . '/certs/smime-covolt-key_staging.key';

// Create a minimal dummy SOAP request (or later call your actual method)
$request = <<<XML
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
    <example:Hello xmlns:example="http://example.com">
      <example:Name>Test</example:Name>
    </example:Hello>
  </soapenv:Body>
</soapenv:Envelope>
XML;

// Load into DOM
$doc = new DOMDocument();
$doc->loadXML($request);

// Create WSSE signer
$objWSSE = new WSSESoap($doc);
$objWSSE->addTimestamp();

// Sign using SubjectKeyIdentifier
$key = new XMLSecurityKey(XMLSecurityKey::RSA_SHA256, ['type'=>'private']);
$key->loadKey($signingKey, true);

// Attach the certificate using SubjectKeyIdentifier
$objWSSE->signSoapDoc($key);

$certContent = file_get_contents($signingCert);
$token = $objWSSE->addBinaryToken($certContent);

// Attach the BinarySecurityToken to the Signature using SubjectKeyIdentifier
$objWSSE->attachTokentoSig($token, false, true);


// Output the signed XML
echo $objWSSE->saveXML();
