<?php

namespace YourNamespace;

use SoapClient;
use DOMDocument;
use RobRichards\WsePhp\WSSESoap;
use RobRichards\XMLSecLibs\XMLSecurityKey;

class TennetSoap extends SoapClient
{
    private string $signingCert;
    private string $signingPk;

    /**
     * @param string|null $wsdl WSDL file or null if not needed
     * @param string $signingCert Path to PEM-encoded public certificate
     * @param string $signingPk   Path to PEM-encoded private key
     * @param array $options      Optional SoapClient options
     */
    public function __construct(?string $wsdl, string $signingCert, string $signingPk, array $options = [])
    {
        parent::__construct($wsdl, $options);
        $this->signingCert = $signingCert;
        $this->signingPk = $signingPk;
    }

    /**
     * Override __doRequest to sign the SOAP request using WSSE
     */
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

        // Send signed request
        return parent::__doRequest($wsse->saveXML(), $location, $action, $version, $one_way);
    }
}
