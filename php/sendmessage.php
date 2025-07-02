<?php
// send_signed_soap.php

$location = 'http://localhost:8081/AncillaryServices/EnergyAccount/v1.0';
$soapAction = 'http://sys.svc.tennet.nl/AncillaryServices/sendEnergyAccount';

$signedXml = file_get_contents(__DIR__ . '/signed_soap_sha256.xml');

$client = new SoapClient(null, [
    'location' => $location,
    'uri' => 'http://schemas.xmlsoap.org/soap/envelope/',
    'trace' => 1,
    'exceptions' => true,
]);

try {
    $response = $client->__doRequest($signedXml, $location, $soapAction, SOAP_1_1);
    echo "✅ Response from server:\n$response\n";
} catch (Exception $e) {
    echo "❌ Error sending signed SOAP: " . $e->getMessage() . "\n";
}