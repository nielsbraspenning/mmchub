<?php
// send_signed_soap.php

$location = 'http://localhost:8081/AncillaryServices/EnergyAccount/v1.0';
<<<<<<< HEAD
$soapAction = 'http://sys.svc.tennet.nl/AncillaryServices/sendEnergyAccount'; // from the WSDL

$signedXml = file_get_contents(__DIR__ . '/signed_soap.xml');
=======
$soapAction = 'EnergyAccount';

$signedXml = file_get_contents(__DIR__ . '/check-basic-signing.xml');
>>>>>>> zonder-changes

$client = new SoapClient(null, [
    'location' => $location,
    'uri' => 'http://schemas.xmlsoap.org/soap/envelope/',
    'trace' => 1,
    'exceptions' => true,
]);

try {
<<<<<<< HEAD
    $response = $client->__doRequest(
        $signedXml,
        $location,
        $soapAction, // ✅ this was previously empty
        SOAP_1_1
    );
    echo "Response from server:\n$response\n";
=======
    $response = $client->__doRequest($signedXml, $location, $soapAction, SOAP_1_1);
    echo "✅ Response from server:\n$response\n";

    // Debug info
    echo "\n\n=== Request Headers ===\n" . $client->__getLastRequestHeaders();
    echo "\n\n=== Request Body ===\n" . $client->__getLastRequest();
    echo "\n\n=== Response Headers ===\n" . $client->__getLastResponseHeaders();
    echo "\n\n=== Response Body ===\n" . $client->__getLastResponse();

>>>>>>> zonder-changes
} catch (Exception $e) {
    echo "❌ Error sending signed SOAP: " . $e->getMessage() . "\n";
}

