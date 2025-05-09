var os = require('os');
if (os.platform() == 'win32') {  
    if (os.arch() == 'ia32') {
        var chilkat = require('@chilkat/ck-node21-win-ia32');
    } else {
        var chilkat = require('@chilkat/ck-node21-win64'); 
    }
} else if (os.platform() == 'linux') {
    if (os.arch() == 'arm') {
        var chilkat = require('@chilkat/ck-node21-arm');
    } else if (os.arch() == 'x86') {
        var chilkat = require('@chilkat/ck-node21-linux32');
    } else {
        var chilkat = require('@chilkat/ck-node21-linux64');
    }
} else if (os.platform() == 'darwin') {
    if (os.arch() == 'arm64') {
        var chilkat = require('@chilkat/ck-node21-mac-m1');
    } else {
        var chilkat = require('@chilkat/ck-node21-macosx');
    }
}


function chilkatExample() {

    var strXml = "... XML to be canonicalized ...";
    var xmldsig = new chilkat.XmlDSig();
    var canonXml = xmldsig.CanonicalizeXml(strXml,"C14N",false);
    console.log(canonXml);

}

chilkatExample();