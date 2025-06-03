<?php

require __DIR__ . '/vendor/autoload.php';
require_once 'TennetSoap.php'; // This should contain your TennetSoap class definition

use RobRichards\WsePhp\WSSESoap;
use RobRichards\XMLSecLibs\XMLSecurityKey;

// === Config ===
$wsdl           =   null; // Or null if you're using __doRequest manually
$signingCert    = __DIR__ . '/certs/smime-covolt-pub_staging.pem';
$signingKey     = __DIR__ . '/certs/smime-covolt-key_staging.key';


function generateEnergyAccountBody(array $params): DOMElement {
    $doc = new DOMDocument('1.0', 'UTF-8');
    $doc->formatOutput = true;

    $ns = 'urn:iec62325.351:tc57wg16:451-4:energyaccountdocument:4:0';
    $root = $doc->createElementNS($ns, 'EnergyAccount_MarketDocument');
    $doc->appendChild($root);

    $addText = function($parent, $name, $value) use ($doc) {
        $el = $doc->createElement($name, $value);
        $parent->appendChild($el);
    };

    $addText($root, 'mRID', $params['mRID']);
    $addText($root, 'revisionNumber', $params['revisionNumber']);
    $addText($root, 'type', 'A45');

    $docStatus = $doc->createElement('docStatus');
    $docStatus->appendChild($doc->createElement('value', 'A07'));
    $root->appendChild($docStatus);

    $addText($root, 'process.processType', 'A28');
    $addText($root, 'process.classificationType', 'A02');

    $sender = $doc->createElement('sender_MarketParticipant.mRID', $params['senderId']);
    $sender->setAttribute('codingScheme', 'A01');
    $root->appendChild($sender);

    $addText($root, 'sender_MarketParticipant.marketRole.type', 'A12');

    $receiver = $doc->createElement('receiver_MarketParticipant.mRID', $params['receiverId']);
    $receiver->setAttribute('codingScheme', 'A01');
    $root->appendChild($receiver);

    $addText($root, 'receiver_MarketParticipant.marketRole.type', 'A04');

    $created = new DateTime($params['createdDateTime'], new DateTimeZone('Europe/Amsterdam'));
    $addText($root, 'createdDateTime', $created->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z'));

    $periodStart = (new DateTime($params['periodStart'], new DateTimeZone('Europe/Amsterdam')))
        ->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i\Z');
    $periodEnd = (new DateTime($params['periodEnd'], new DateTimeZone('Europe/Amsterdam')))
        ->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i\Z');

    $interval = $doc->createElement('period.timeInterval');
    $interval->appendChild($doc->createElement('start', $periodStart));
    $interval->appendChild($doc->createElement('end', $periodEnd));
    $root->appendChild($interval);

    $ts = $doc->createElement('TimeSeries');
    $addText($ts, 'mRID', $params['timeSeriesId']);
    $addText($ts, 'businessType', 'A11');
    $addText($ts, 'product', $params['product']);
    $addText($ts, 'objectAggregation', 'A02');

    $area = $doc->createElement('area_Domain.mRID', '10YNL----------L');
    $area->setAttribute('codingScheme', 'A01');
    $ts->appendChild($area);

    $addText($ts, 'measure_Unit.name', 'MAW');
    $addText($ts, 'currency_Unit.name', 'EUR');

    $mep = $doc->createElement('marketEvaluationPoint.mRID', $params['marketEvaluationPointId']);
    $mep->setAttribute('codingScheme', 'A01');
    $ts->appendChild($mep);

    $period = $doc->createElement('Period');
    $ti = $doc->createElement('timeInterval');
    $ti->appendChild($doc->createElement('start', $periodStart));
    $ti->appendChild($doc->createElement('end', $periodEnd));
    $period->appendChild($ti);

    $period->appendChild($doc->createElement('resolution', 'PT' . $params['sampleInterval'] . 'S'));

    for ($i = 1; $i <= 10; $i++) {
        $value = round(mt_rand(0, 999999999) / 1000000, 6);
        $point = $doc->createElement('Point');
        $addText($point, 'position', $i);
        $addText($point, 'in_Quantity.quantity', $value >= 0 ? '0.000000' : number_format(abs($value), 6, '.', ''));
        $addText($point, 'out_Quantity.quantity', $value >= 0 ? number_format($value, 6, '.', '') : '0.000000');
        $period->appendChild($point);
    }

    $ts->appendChild($period);
    $root->appendChild($ts);

    return $doc->documentElement;
}

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

    public function __doRequest(string $request, string $location, string $action, int $version, bool $one_way = false): ?string
    {
        $doc = new DOMDocument('1.0');
        $doc->loadXML($request); // ✅ Correct usage

        // Generate the EnergyAccount_MarketDocument content
        $bodyElement = generateEnergyAccountBody([
            'mRID' => 'DOC-FCR-20250514-0001',
            'revisionNumber' => 1,
            'senderId' => '8719333027500',
            'receiverId' => '8716867999983',
            'createdDateTime' => '2025-05-14T14:00:00',
            'periodStart' => '2025-05-15T00:00:00',
            'periodEnd' => '2025-05-16T04:00:00',
            'timeSeriesId' => 'TS-20250514-01',
            'product' => '8716867000016',
            'marketEvaluationPointId' => '871687910000500037',
            'sampleInterval' => 1
        ]);

        // Insert into <soapenv:Body>
        $xpath = new DOMXPath($doc);
        $xpath->registerNamespace('soapenv', 'http://schemas.xmlsoap.org/soap/envelope/');
        $bodyNode = $xpath->query('//soapenv:Body')->item(0);
        $importedBody = $doc->importNode($bodyElement, true);
    
        // Remove any placeholder <dummy:EnergyAccount_MarketDocument> if present
        while ($bodyNode->firstChild) {
            $bodyNode->removeChild($bodyNode->firstChild);
        }

        $bodyNode->appendChild($importedBody);

        // Sign
        $wsse = new WSSESoap($doc);
        $key = new XMLSecurityKey(XMLSecurityKey::RSA_SHA256, ['type' => 'private']);
        $key->loadKey($this->signingPk, true);
        $wsse->signSoapDoc($key);
        $token = $wsse->addBinaryToken(file_get_contents($this->signingCert));
        $wsse->attachTokentoSig($token);

        // Output
        $signedXml = $wsse->saveXML();
        echo "===== SIGNED SOAP XML =====\n";
        echo $signedXml . "\n";
        echo "===========================\n";

      //  return null; // or: return parent::__doRequest($signedXml, $location, $action, $version, $one_way);
        return parent::__doRequest($signedXml, $location, $action, $version, $one_way);
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
        'location' => 'http://localhost:8081/AncillaryServices/EnergyAccount/v1.0',
        'uri' => 'http://schemas.xmlsoap.org/soap/envelope/',
        'trace' => 1,
        'exceptions' => true
    ]
);


try {
    $response = $client->__doRequest($requestBody, 'http://localhost:8081/AncillaryServices/EnergyAccount/v1.0', '', SOAP_1_1);
    echo "Signed SOAP Response:\n\n$response";
} catch (Exception $e) {
    echo "Error sending signed SOAP: " . $e->getMessage();
}
