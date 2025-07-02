<?php
// send_signed_soap.php

$location = 'http://localhost:8081/AncillaryServices/EnergyAccount/v1.0';
$soapAction = 'EnergyAccount';

$signedXml = file_get_contents(__DIR__ . '/check-basic-signing.xml');

$client = new SoapClient(null, [
    'location' => $location,
    'uri' => 'http://schemas.xmlsoap.org/soap/envelope/',
    'trace' => 1,
    'exceptions' => true,
]);

try {
    $response = $client->__doRequest($signedXml, $location, $soapAction, SOAP_1_1);
    echo "✅ Response from server:\n$response\n";

    // Debug info
    echo "\n\n=== Request Headers ===\n" . $client->__getLastRequestHeaders();
    echo "\n\n=== Request Body ===\n" . $client->__getLastRequest();
    echo "\n\n=== Response Headers ===\n" . $client->__getLastResponseHeaders();
    echo "\n\n=== Response Body ===\n" . $client->__getLastResponse();

} catch (Exception $e) {
    echo "❌ Error sending signed SOAP: " . $e->getMessage() . "\n";
}

