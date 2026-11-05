import java.nio.file.*;
import java.security.*;
import java.security.cert.X509Certificate;
import java.util.HexFormat;

// Never print exception messages: providers can include sensitive input in them.
class VerifyAndroidSigning {
    public static void main(String[] args) {
        String stage = "STORE_OPEN";
        try {
            var env = System.getenv();
            var store = KeyStore.getInstance(new java.io.File(env.get("CALENDAR_KEYSTORE_PATH")),
                env.get("CALENDAR_KEYSTORE_PASSWORD").toCharArray());
            stage = "KEY_ALIAS";
            var alias = env.get("CALENDAR_KEY_ALIAS");
            if (!store.containsAlias(alias)) throw new Exception();
            stage = "KEY_ACCESS";
            var key = store.getKey(alias, env.get("CALENDAR_KEY_PASSWORD").toCharArray());
            if (!(key instanceof PrivateKey)) throw new Exception();
            stage = "CERTIFICATE";
            var cert = (X509Certificate) store.getCertificate(alias);
            stage = "CERTIFICATE_VALIDITY";
            cert.checkValidity();
            stage = "CERTIFICATE_SHA256";
            var digest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(cert.getEncoded()));
            if (!digest.equals(env.get("EXPECTED_ANDROID_CERTIFICATE"))) {
                // A certificate fingerprint is public metadata, never key/password material.
                System.err.println("Android signing certificate SHA-256 digest: " + digest);
                throw new Exception();
            }
            stage = "PRIVATE_KEY_PROOF";
            var algorithm = switch (key.getAlgorithm()) {
                case "RSA" -> "SHA256withRSA";
                case "EC" -> "SHA256withECDSA";
                case "DSA" -> "SHA256withDSA";
                default -> throw new Exception();
            };
            var signer = Signature.getInstance(algorithm);
            byte[] challenge = new byte[32];
            new SecureRandom().nextBytes(challenge);
            signer.initSign((PrivateKey) key);
            signer.update(challenge);
            byte[] signature = signer.sign();
            signer.initVerify(cert);
            signer.update(challenge);
            if (!signer.verify(signature)) throw new Exception();
            System.out.println("Android update signing identity and private-key access verified.");
        } catch (Throwable error) {
            System.err.println("Android signing validation failed at " + stage + ": check the existing update keystore, passwords, alias and certificate. No build is allowed.");
            System.exit(1);
        }
    }
}
