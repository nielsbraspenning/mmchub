<?php

require __DIR__ . '/vendor/autoload.php';
require_once 'TennetSoap.php'; // This should contain your TennetSoap class definition

use RobRichards\WsePhp\WSSESoap;
use RobRichards\XMLSecLibs\XMLSecurityKey;

// === Config ===
$wsdl           =   null; // Or null if you're using __doRequest manually
$signingCert    = __DIR__ . '/certs/smime-covolt-pub_staging.pem';
$signingKey     = __DIR__ . '/certs/smime-covolt-key_staging.key';

// === Minimal SoapClient subclass with only signing ===
class TennetSoap extends SoapClient
{
    private $signingCert;
    private $signingPk;

    public function __construct($wsdl, $signingCert, $signingPk, array $options = [])
    {
        parent::__construct($wsdl, $options);
        $this->signingCert = $signingCert;
        $this->signingPk = $signingPk;
    }

   // public function __doRequest($request, $location, $saction, $version, $one_way = NULL)
   // {
   //     $doc = new DOMDocument('1.0');
   //     $doc->loadXML($request);
//
   //     $objWSSE = new WSSESoap($doc);
//
   //     $objKey = new XMLSecurityKey(XMLSecurityKey::RSA_SHA256, ['type' => 'private']);
   //     $objKey->loadKey($this->signingPk, true);
//
   //     $objWSSE->signSoapDoc($objKey);
//
   //     $token = $objWSSE->addBinaryToken(file_get_contents($this->signingCert));
   //     $objWSSE->attachTokentoSig($token);
//
   //     return parent::__doRequest($objWSSE->saveXML(), $location, $saction, $version, $one_way);
   // }


    public function __doRequest(string $request, string $location, string $action, int $version, bool $one_way = false): ?string
    {
        $doc = new DOMDocument('1.0');
        $doc->loadXML($request);

        // Initialize WSSE handler
        $wsse = new WSSESoap($doc);

        // Load private key
        $key = new XMLSecurityKey(XMLSecurityKey::RSA_SHA256, ['type' => 'private']);
        $key->loadKey($this->signingPk, true);

        // Sign the SOAP body
        $wsse->signSoapDoc($key);

        // Attach BinarySecurityToken (public cert)
        $token = $wsse->addBinaryToken(file_get_contents($this->signingCert));
        $wsse->attachTokentoSig($token);

        // --- Show the signed XML ---
        $signedXml = $wsse->saveXML();
        echo "===== SIGNED SOAP XML =====\n";
        echo $signedXml . "\n";
        echo "===========================\n";

        // Comment the line below to prevent actual sending
        // return parent::__doRequest($signedXml, $location, $action, $version, $one_way);

        // For debug mode: just return the raw XML (as if it was a response)
        return null;
    }
}


// === Dummy SOAP envelope ===
$requestBody = <<<XML
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
                  xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <soapenv:Header>
    <MessageAddressing xmlns="http://sys.svc.tennet.nl/MMCHub/Header/v1">
      <technicalMessageId>dummy-id-1234</technicalMessageId>
      <correlationId>dummy-id-1234</correlationId>
      <senderId>8719333027500</senderId>
      <receiverId>8716867999983</receiverId>
      <carrierId>8719333027500</carrierId>
      <contentType>ACTIVATED_FCR</contentType>
    </MessageAddressing>
  </soapenv:Header>
  <soapenv:Body wsu:Id="Body">
    <dummy:EnergyAccount_MarketDocument xmlns:dummy="urn:iec62325.351:tc57wg16:451-4:energyaccountdocument:4:0">
      <mRID>DUMMY-DOC-ID</mRID>
      <revisionNumber>1</revisionNumber>
      <type>A45</type>
      <createdDateTime>2025-06-03T12:00:00Z</createdDateTime>
    </dummy:EnergyAccount_MarketDocument>
  </soapenv:Body>
</soapenv:Envelope>
XML;

// === Create and use the TennetSoap client ===
$client = new TennetSoap(
    $wsdl,
    $signingCert,
    $signingKey,
    [
        'location' => 'https://dummy.tennet.nl/endpoint',
        'uri' => 'http://schemas.xmlsoap.org/soap/envelope/',
        'trace' => 1,
        'exceptions' => true
    ]
);

try {
    $response = $client->__doRequest($requestBody, 'https://dummy.tennet.nl/endpoint', '', SOAP_1_1);
    echo "Signed SOAP Response:\n\n$response";
} catch (Exception $e) {
    echo "Error sending signed SOAP: " . $e->getMessage();
}
