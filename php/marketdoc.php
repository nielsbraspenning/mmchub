<?php

require __DIR__ . '/vendor/autoload.php';

use RobRichards\XMLSecLibs\XMLSecurityKey;
use RobRichards\WsePhp\WSSESoap;
use RobRichards\XMLSecLibs\XMLSecurityDSig;

// === CONFIG ===
$signingCert = __DIR__ . '/certs/smime-covolt-pub_staging.pem';
$signingKey  = __DIR__ . '/certs/smime-covolt-key_staging.key';
$signingLeafCert  = __DIR__ . '/certs/smime-covotl-leaf_staging.pem';

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

    // TimeSeries
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

    // Period
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

// === Dummy SOAP message (zonder body) ===
$request = <<<XML
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
                  xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
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
  <soapenv:Body wsu:Id="Body"/>
</soapenv:Envelope>
XML;

// === Load into DOMDocument ===
$doc = new DOMDocument();
$doc->loadXML($request);

// === Add generated Body content ===
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

$xpath = new DOMXPath($doc);
$xpath->registerNamespace('soapenv', 'http://schemas.xmlsoap.org/soap/envelope/');
$bodyNode = $xpath->query('//soapenv:Body')->item(0);
$imported = $doc->importNode($bodyElement, true);
$bodyNode->appendChild($imported);

// === WSSE handler ===
$objWSSE = new WSSESoap($doc);

// Voeg de wsse:Security header toe (zonder username/password)
$objWSSE->addUserToken('', '', false);

// Laad het certificaat en voeg het toe als BinarySecurityToken
$certContent = file_get_contents($signingCert);
$token = $objWSSE->addBinaryToken($certContent);

// Laad de private key
$key = new XMLSecurityKey(XMLSecurityKey::RSA_SHA256, ['type' => 'private']);
$key->loadKey($signingKey, true);
//$key->cert = $certContent; // Nodig voor SubjectKeyIdentifier

// Print de volledige signed SOAP
echo $objWSSE->saveXML();
