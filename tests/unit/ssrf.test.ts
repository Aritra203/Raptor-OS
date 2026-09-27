import { describe, it, expect } from "vitest";
import { validateWebhookUrl, isSafeWebhookUrl } from "@/lib/security/ssrf";
import { ValidationError } from "@/lib/errors/app-error";

describe("Webhook SSRF Protection Tests (Phase 10 Hardening)", () => {
  describe("Cloud metadata endpoints (unconditional block)", () => {
    it("blocks AWS/Azure/OpenStack metadata IP", () => {
      expect(() =>
        validateWebhookUrl("http://169.254.169.254/latest/meta-data")
      ).toThrow(ValidationError);
      expect(
        isSafeWebhookUrl("http://169.254.169.254/latest/meta-data")
      ).toBe(false);
    });

    it("blocks GCP metadata endpoint", () => {
      expect(() =>
        validateWebhookUrl("http://metadata.google.internal/computeMetadata/v1/")
      ).toThrow(ValidationError);
      expect(
        isSafeWebhookUrl("http://metadata.google.internal/computeMetadata/v1/")
      ).toBe(false);
    });

    it("blocks cloud metadata even when allowPrivate is true", () => {
      expect(() =>
        validateWebhookUrl("http://169.254.169.254/latest/meta-data", {
          allowPrivate: true,
        })
      ).toThrow(ValidationError);
    });
  });

  describe("Internal hostnames and loopbacks", () => {
    it("blocks localhost", () => {
      expect(() =>
        validateWebhookUrl("http://localhost:3000/webhook", {
          allowPrivate: false,
        })
      ).toThrow(ValidationError);
      expect(
        isSafeWebhookUrl("http://localhost:3000/webhook", {
          allowPrivate: false,
        })
      ).toBe(false);
    });

    it("blocks 127.0.0.1", () => {
      expect(() =>
        validateWebhookUrl("http://127.0.0.1:8080/events", {
          allowPrivate: false,
        })
      ).toThrow(ValidationError);
    });

    it("blocks IPv6 loopback [::1]", () => {
      expect(() =>
        validateWebhookUrl("http://[::1]:8080/events", {
          allowPrivate: false,
        })
      ).toThrow(ValidationError);
    });

    it("blocks internal docker service names (postgres, db, host.docker.internal)", () => {
      expect(() =>
        validateWebhookUrl("http://postgres:5432/webhook", {
          allowPrivate: false,
        })
      ).toThrow(ValidationError);
      expect(() =>
        validateWebhookUrl("http://db/webhook", { allowPrivate: false })
      ).toThrow(ValidationError);
      expect(() =>
        validateWebhookUrl("http://host.docker.internal:8080/webhook", {
          allowPrivate: false,
        })
      ).toThrow(ValidationError);
    });
  });

  describe("Private IP ranges (RFC 1918)", () => {
    it("blocks 10.0.0.0/8", () => {
      expect(() =>
        validateWebhookUrl("http://10.0.1.50/receiver", {
          allowPrivate: false,
        })
      ).toThrow(ValidationError);
    });

    it("blocks 172.16.0.0/12", () => {
      expect(() =>
        validateWebhookUrl("http://172.20.0.2:8000/hook", {
          allowPrivate: false,
        })
      ).toThrow(ValidationError);
    });

    it("blocks 192.168.0.0/16", () => {
      expect(() =>
        validateWebhookUrl("http://192.168.1.100/notify", {
          allowPrivate: false,
        })
      ).toThrow(ValidationError);
    });
  });

  describe("Protocol and port security", () => {
    it("rejects non-HTTP protocols (file, gopher, ftp)", () => {
      expect(() => validateWebhookUrl("file:///etc/passwd")).toThrow(
        ValidationError
      );
      expect(() => validateWebhookUrl("gopher://127.0.0.1:70/")).toThrow(
        ValidationError
      );
      expect(() => validateWebhookUrl("ftp://example.com/file")).toThrow(
        ValidationError
      );
    });

    it("rejects prohibited ports (Postgres 5432, Redis 6379, SSH 22)", () => {
      expect(() =>
        validateWebhookUrl("http://example.com:5432/webhook")
      ).toThrow(ValidationError);
      expect(() =>
        validateWebhookUrl("http://example.com:6379/webhook")
      ).toThrow(ValidationError);
      expect(() =>
        validateWebhookUrl("http://example.com:22/webhook")
      ).toThrow(ValidationError);
    });

    it("rejects user credentials in URL", () => {
      expect(() =>
        validateWebhookUrl("https://admin:secret@api.example.com/webhook")
      ).toThrow(ValidationError);
    });
  });

  describe("Legitimate public webhooks", () => {
    it("allows valid public HTTPS webhook URLs", () => {
      expect(
        validateWebhookUrl("https://api.example.com/v1/webhooks/incoming")
      ).toBe(true);
      expect(
        validateWebhookUrl("https://webhook.site/3f82b7a9-1123-41a4-9df7-111111111111")
      ).toBe(true);
      expect(
        validateWebhookUrl("https://discord.com/api/webhooks/123456789/abcdef")
      ).toBe(true);
    });

    it("allows local webhooks when allowPrivate is explicitly enabled", () => {
      expect(
        validateWebhookUrl("http://127.0.0.1:9999/test-webhook", {
          allowPrivate: true,
        })
      ).toBe(true);
      expect(
        validateWebhookUrl("http://localhost:3000/api/hook", {
          allowPrivate: true,
        })
      ).toBe(true);
    });
  });
});
