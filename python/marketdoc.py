from lxml import etree
from datetime import datetime, timedelta
import pytz
import random
import uuid as uuidlib
from signature import CustomSignature
import xmlsec



def generate_points(start_local, stop_local, interval_seconds):
    tz = pytz.timezone('Europe/Amsterdam')
    start = tz.localize(datetime.fromisoformat(start_local))
    end = tz.localize(datetime.fromisoformat(stop_local))

    num_points = 10  # fixed for now
    points = []

    for i in range(1, num_points + 1):
        raw = random.random() * 999.999999
        points.append({
            "position": i,
            "in": f"{raw:.6f}" if raw < 0 else "0.000000",
            "out": f"{raw:.6f}" if raw >= 0 else "0.000000"
        })

    return points

def build_energy_account_xml(params):
    ns = "urn:iec62325.351:tc57wg16:451-4:energyaccountdocument:4:0"
    doc = etree.Element("EnergyAccount_MarketDocument", nsmap={None: ns})

    def add(tag, text, parent=doc, attrib=None):
        el = etree.SubElement(parent, tag, attrib=attrib if attrib else {})
        el.text = str(text)
        return el

    add("mRID", params["mRID"])
    add("revisionNumber", params["revisionNumber"])
    add("type", "A45")
    ds = add("docStatus", "", parent=doc)
    add("value", "A07", parent=ds)
    add("process.processType", "A28")
    add("process.classificationType", "A02")
    add("sender_MarketParticipant.mRID", params["senderId"], attrib={"codingScheme": "A01"})
    add("sender_MarketParticipant.marketRole.type", "A12")
    add("receiver_MarketParticipant.mRID", params["receiverId"], attrib={"codingScheme": "A01"})
    add("receiver_MarketParticipant.marketRole.type", "A04")

    created_dt_utc = pytz.timezone('Europe/Amsterdam').localize(
        datetime.fromisoformat(params["createdDateTime"])
    ).astimezone(pytz.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    add("createdDateTime", created_dt_utc)

    pti = add("period.timeInterval", "", parent=doc)
    start_utc = pytz.timezone('Europe/Amsterdam').localize(
        datetime.fromisoformat(params["periodStart"])
    ).astimezone(pytz.utc).strftime('%Y-%m-%dT%H:%MZ')
    end_utc = pytz.timezone('Europe/Amsterdam').localize(
        datetime.fromisoformat(params["periodEnd"])
    ).astimezone(pytz.utc).strftime('%Y-%m-%dT%H:%MZ')
    add("start", start_utc, parent=pti)
    add("end", end_utc, parent=pti)

    ts = add("TimeSeries", "", parent=doc)
    add("mRID", params["timeSeriesId"], parent=ts)
    add("businessType", "A11", parent=ts)
    add("product", params["product"], parent=ts)
    add("objectAggregation", "A02", parent=ts)
    add("area_Domain.mRID", "10YNL----------L", parent=ts, attrib={"codingScheme": "A01"})
    add("measure_Unit.name", "MAW", parent=ts)
    add("currency_Unit.name", "EUR", parent=ts)
    add("marketEvaluationPoint.mRID", params["marketEvaluationPointId"], parent=ts, attrib={"codingScheme": "A01"})

    period = add("Period", "", parent=ts)
    ti = add("timeInterval", "", parent=period)
    add("start", start_utc, parent=ti)
    add("end", end_utc, parent=ti)
    add("resolution", f"PT{params['sampleInterval']}S", parent=period)

    points = generate_points(params["periodStart"], params["periodEnd"], params["sampleInterval"])
    for p in points:
        pt = add("Point", "", parent=period)
        add("position", p["position"], parent=pt)
        add("in_Quantity.quantity", p["in"], parent=pt)
        add("out_Quantity.quantity", p["out"], parent=pt)

    return etree.ElementTree(doc)

def build_unsigned_soap(body_tree, sender_id, receiver_id, reference_uri):
    NSMAP = {
        'soapenv': 'http://schemas.xmlsoap.org/soap/envelope/',
        'wsse': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd',
        'soap': 'http://schemas.xmlsoap.org/soap/envelope/',
        'wsu': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd'
    }

    envelope = etree.Element('{http://schemas.xmlsoap.org/soap/envelope/}Envelope', nsmap=NSMAP)
    header = etree.SubElement(envelope, '{http://schemas.xmlsoap.org/soap/envelope/}Header')

    technical_message_id = str(uuidlib.uuid4())
    ns = "http://sys.svc.tennet.nl/MMCHub/Header/v1"

    ma = etree.SubElement(header, f'{{{ns}}}MessageAddressing')
    etree.SubElement(ma, f'{{{ns}}}technicalMessageId').text = technical_message_id
    etree.SubElement(ma, f'{{{ns}}}correlationId').text = technical_message_id
    etree.SubElement(ma, f'{{{ns}}}senderId').text = sender_id
    etree.SubElement(ma, f'{{{ns}}}receiverId').text = receiver_id
    etree.SubElement(ma, f'{{{ns}}}carrierId').text = sender_id
    etree.SubElement(ma, f'{{{ns}}}contentType').text = 'ACTIVATED_FCR'

    # WSSE Security block (empty for now, will be filled during signing)
    etree.SubElement(header, '{http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd}Security', attrib={
        '{http://schemas.xmlsoap.org/soap/envelope/}mustUnderstand': '1'
    })

    # Body with reference ID
    body = etree.SubElement(envelope, '{http://schemas.xmlsoap.org/soap/envelope/}Body', attrib={
        '{http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd}Id': reference_uri
    })

    # Import the energy account XML as the body content
    body.append(body_tree.getroot())

    return etree.ElementTree(envelope)



params = {
    "mRID": "DOC-FCR-20250514-0001",
    "revisionNumber": 1,
    "senderId": "8719333027500",
    "receiverId": "8716867999983",
    "createdDateTime": "2025-05-14T14:00:00",
    "sampleInterval": 1,
    "periodStart": "2025-05-15T00:00:00",
    "periodEnd": "2025-05-16T04:00:00",
    "timeSeriesId": "TS-20250514-01",
    "product": "8716867000016",
    "marketEvaluationPointId": "871687910000500037"
}

#body_tree = build_energy_account_xml(params)
#soap_tree = build_unsigned_soap(body_tree, sender_id="8719333027500", receiver_id="8716867999983", reference_uri="Body")

#print(etree.tostring(soap_tree, pretty_print=True, encoding="unicode"))


# Generate the body XML
body_tree = build_energy_account_xml(params)

# Create SOAP envelope with a fixed wsu:Id
reference_uri = "Body"
soap_tree = build_unsigned_soap(body_tree, sender_id=params["senderId"], receiver_id=params["receiverId"], reference_uri=reference_uri)

# Create WSSE signature object
wsse = CustomSignature(
    key_file='certificates/smime-covolt-key_staging.key',
    certfile='certificates/smime-covolt-pub_staging.pem',
    counter_part_cert= None,
    signature_method=xmlsec.constants.TransformRsaSha256,
    digest_method=xmlsec.constants.TransformSha256
)

# Apply the signature
signed_envelope, _ = wsse.apply(soap_tree, headers={})

# Convert to string and print
signed_xml = etree.tostring(signed_envelope, pretty_print=True, encoding='utf-8', xml_declaration=True).decode('utf-8')
print(signed_xml)

# Optional: Send to TenneT (uncomment to use)
"""
import requests
response = requests.post(
    url="https://your-tennet-endpoint",
    data=signed_xml,
    headers={"Content-Type": "text/xml"}
)
print("Status:", response.status_code)
print(response.text)
"""

