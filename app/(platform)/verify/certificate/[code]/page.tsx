import Link from "next/link";
import { certificateService } from "@/server/services/certificate.service";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CertificateVerificationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const decodedCode = decodeURIComponent(code);

  const verification = await certificateService.verifyCertificate(
    decodedCode,
    "web-client"
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-xl">
        {/* Navigation back */}
        <div className="mb-6">
          <Link
            href="/verify/certificate"
            className="inline-flex items-center text-sm text-slate-400 hover:text-cyan-400 transition-colors gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Verify another certificate
          </Link>
        </div>

        {/* Certificate Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-sm">
          {/* Subtle background glow depending on status */}
          {verification.status === "VALID" && (
            <div className="absolute -right-16 -top-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          )}
          {verification.status === "REVOKED" && (
            <div className="absolute -right-16 -top-16 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          )}
          {verification.status === "NOT_FOUND" && (
            <div className="absolute -right-16 -top-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          )}

          {/* Header Status Badge */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">
                  RaptorOS Verification
                </h1>
                <p className="text-xs text-slate-400">
                  Cryptographic Participant Record
                </p>
              </div>
            </div>

            {verification.status === "VALID" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 shadow-sm shadow-emerald-950/50">
                <CheckCircle2 className="w-3.5 h-3.5" />
                OFFICIALLY VALID
              </span>
            )}

            {verification.status === "REVOKED" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-950/80 border border-rose-700/60 text-rose-400 shadow-sm shadow-rose-950/50">
                <XCircle className="w-3.5 h-3.5" />
                REVOKED
              </span>
            )}

            {verification.status === "NOT_FOUND" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-950/80 border border-amber-700/60 text-amber-400 shadow-sm shadow-amber-950/50">
                <AlertTriangle className="w-3.5 h-3.5" />
                NOT FOUND
              </span>
            )}
          </div>

          {/* Verification Details */}
          {verification.certificate ? (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  {verification.certificate.type} CERTIFICATE
                </span>
                <h2 className="text-2xl font-extrabold text-white mt-1">
                  {verification.certificate.title}
                </h2>
                {verification.certificate.description && (
                  <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                    {verification.certificate.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-sm">
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">Awarded To</span>
                  <span className="font-semibold text-slate-100">
                    {verification.certificate.recipientName}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">Event</span>
                  <span className="font-semibold text-slate-100">
                    {verification.certificate.eventName}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">Issued Date</span>
                  <span className="text-slate-300 font-mono text-xs">
                    {new Date(verification.certificate.issuedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">Verification Code</span>
                  <span className="text-cyan-400 font-mono text-xs select-all">
                    {verification.certificate.verificationId}
                  </span>
                </div>
              </div>

              {verification.status === "REVOKED" && verification.certificate.revocationReason && (
                <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 text-sm text-rose-300">
                  <span className="font-semibold block mb-1">Revocation Notice:</span>
                  <p>{verification.certificate.revocationReason}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-950/60 border border-amber-800 flex items-center justify-center mx-auto text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-200">
                Certificate Not Found
              </h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                No certificate was found matching the code{" "}
                <span className="font-mono text-amber-400">{decodedCode}</span>. Please verify the code or contact the event organizers.
              </p>
            </div>
          )}

          {/* Footer note */}
          <div className="mt-8 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span>Verified by RaptorOS Engine</span>
            <span>Tamper-evident record</span>
          </div>
        </div>
      </div>
    </div>
  );
}
