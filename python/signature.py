import base64
import logging
from cryptography import x509
from lxml import etree
from zeep.wsse.signature import Signature, _make_verify_key, _verify_envelope_with_key, _read_file


def get_key_identifier(path_to_public_key):
    with open(path_to_public_key, "rb") as cert_file:
        cert_data = cert_file.read()
        certificate = x509.load_pem_x509_certificate(cert_data)

    try:
        ski = certificate.extensions.get_extension_for_oid(
            x509.ExtensionOID.SUBJECT_KEY_IDENTIFIER
        ).value
        return base64.b64encode(ski.digest).decode("ascii")
    except x509.ExtensionNotFound:
        logging.error("Subject Key Identifier not found in the certificate.")
        raise


class CustomSignature(Signature):
    def __init__(self, key_file, certfile, counter_part_cert=None, password=None, signature_method=None, digest_method=None):
        self.ski = get_key_identifier(certfile)

        if counter_part_cert:
            self.counter_part_cert = _read_file(counter_part_cert)
        else:
            self.counter_part_cert = None

        super().__init__(key_file, certfile, password, signature_method, digest_method)

    def verify(self, envelope):
        if not self.counter_part_cert:
            raise ValueError("No counter party cert available for verification.")
        key = _make_verify_key(self.counter_part_cert)
        _verify_envelope_with_key(envelope, key)
        return envelope


    def apply(self, envelope, headers):
        logging.debug("CustomSignature: apply called")
        envelope, headers = super().apply(envelope, headers)

        key_info = envelope.xpath('.//*[local-name()="KeyInfo"]')[0]
        key_info.clear()

        security_token_reference = etree.SubElement(
            key_info,
            "{http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd}SecurityTokenReference"
        )

        key_identifier = etree.SubElement(
            security_token_reference,
            "{http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd}KeyIdentifier"
        )

        key_identifier.set("ValueType",
            "http://docs.oasis-open.org/wss/oasis-wss-x509-token-profile-1.1#SubjectKeyIdentifier")
        key_identifier.set("EncodingType",
            "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary")

        key_identifier.text = self.ski
        return envelope, headers
