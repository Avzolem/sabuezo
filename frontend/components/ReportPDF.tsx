"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

type Finding = {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  fix: string;
  fix_time_min: number;
};

export type ScanReport = {
  url: string;
  domain: string;
  score: number;
  summary: string;
  findings: Finding[];
  raw?: {
    ssl?: { ok?: boolean; days_to_expiry?: number; issuer?: string };
    email_auth?: {
      spf_present?: boolean;
      dmarc_present?: boolean;
      dmarc_policy?: string;
      dkim_selectors_found?: string[];
    };
    cms?: { cms?: string; version?: string | null };
    domain_age_days?: number | null;
    exposed_paths?: { path: string }[];
  };
  scanned_at?: string;
};

const C = {
  // Paleta neutra y profesional
  bg: "#ffffff",
  text: "#0a0a0b",
  textMuted: "#52525b",
  textLight: "#a1a1aa",
  border: "#e4e4e7",
  borderStrong: "#d4d4d8",
  bgSoft: "#fafafa",
  bgMuted: "#f4f4f5",
  // Brand
  amber: "#f59e0b",
  amberSoft: "#fffbeb",
  amberBorder: "#fcd34d",
  // Severity
  red: "#dc2626",
  redSoft: "#fef2f2",
  orange: "#ea580c",
  orangeSoft: "#fff7ed",
  yellow: "#ca8a04",
  yellowSoft: "#fefce8",
  blue: "#2563eb",
  blueSoft: "#eff6ff",
  zinc: "#52525b",
  zincSoft: "#f4f4f5",
  // Score
  green: "#16a34a",
};

const SEV_LABEL: Record<string, string> = {
  critical: "CRÍTICO",
  high: "ALTO",
  medium: "MEDIO",
  low: "BAJO",
  info: "INFO",
};

function sevColors(sev: string): { color: string; bg: string } {
  return {
    critical: { color: C.red, bg: C.redSoft },
    high: { color: C.orange, bg: C.orangeSoft },
    medium: { color: C.yellow, bg: C.yellowSoft },
    low: { color: C.blue, bg: C.blueSoft },
    info: { color: C.zinc, bg: C.zincSoft },
  }[sev] || { color: C.zinc, bg: C.zincSoft };
}

function scoreColor(score: number): string {
  if (score >= 85) return C.green;
  if (score >= 65) return C.yellow;
  if (score >= 40) return C.orange;
  return C.red;
}

function scoreBg(score: number): string {
  if (score >= 85) return "#f0fdf4";
  if (score >= 65) return C.yellowSoft;
  if (score >= 40) return C.orangeSoft;
  return C.redSoft;
}

function scoreLabel(score: number): string {
  if (score >= 85) return "Bien protegido";
  if (score >= 65) return "Mejoras importantes";
  if (score >= 40) return "Puertas abiertas";
  return "Crítico";
}

const s = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    color: C.text,
    paddingTop: 44,
    paddingHorizontal: 48,
    paddingBottom: 56,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.55,
  },

  // ─── Header ───
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 28,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.amber,
  },
  brandText: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.text,
    letterSpacing: 0.3,
  },
  brandTagline: {
    fontSize: 9,
    color: C.textLight,
    marginLeft: 4,
  },
  headerRight: {
    fontSize: 9,
    color: C.textLight,
  },

  // ─── Hero ───
  hero: { marginBottom: 24 },
  eyebrow: {
    fontSize: 8,
    color: C.amber,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 12,
    lineHeight: 1,
  },
  h1: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: C.text,
    lineHeight: 1.2,
    marginBottom: 10,
  },
  urlLine: {
    fontSize: 11,
    color: C.textMuted,
    lineHeight: 1.4,
    marginBottom: 6,
  },
  date: {
    fontSize: 9,
    color: C.textLight,
    lineHeight: 1.4,
  },

  // ─── Score Card ───
  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    padding: 22,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 18,
    marginBottom: 24,
  },
  scoreCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#ffffff",
    borderWidth: 5,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 6, // compensar baseline de Text en react-pdf
  },
  scoreNumber: {
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    lineHeight: 1,
  },
  scoreInfo: { flex: 1 },
  scoreLabelText: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    lineHeight: 1.2,
  },
  scoreSummary: {
    fontSize: 10,
    color: C.textMuted,
    lineHeight: 1.55,
  },

  // ─── Insight ───
  insight: {
    borderLeftWidth: 3,
    borderLeftColor: C.amber,
    backgroundColor: C.amberSoft,
    padding: 16,
    borderRadius: 4,
    marginBottom: 28,
  },
  insightLabel: {
    fontSize: 7,
    color: C.amber,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.8,
    marginBottom: 6,
  },
  insightTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: C.text,
  },
  insightBody: { fontSize: 10, color: C.text, lineHeight: 1.6 },

  // ─── Sections ───
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 18,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.text,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  sectionCount: {
    fontSize: 10,
    color: C.textLight,
    marginLeft: 8,
  },

  // ─── Finding card ───
  finding: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  findingHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 10,
  },
  findingTitle: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.text,
    lineHeight: 1.4,
  },
  sevBadge: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    letterSpacing: 0.8,
  },
  findingDesc: {
    fontSize: 10,
    color: C.textMuted,
    marginBottom: 10,
    lineHeight: 1.6,
  },
  fix: {
    backgroundColor: C.bgMuted,
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 2,
    borderLeftColor: C.amber,
  },
  fixLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.amber,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  fixText: {
    fontSize: 9.5,
    color: C.text,
    lineHeight: 1.6,
  },
  fixCode: {
    fontSize: 9,
    fontFamily: "Courier",
    color: C.text,
    lineHeight: 1.55,
  },

  // ─── Tech details ───
  techSection: {
    marginTop: 28,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  techTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.text,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  techGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  techCell: {
    width: "48%",
    backgroundColor: C.bgSoft,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 10,
  },
  techKey: {
    fontSize: 8,
    color: C.textLight,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  techVal: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.text,
  },

  // ─── CTA ───
  cta: {
    marginTop: 28,
    backgroundColor: C.text,
    padding: 22,
    borderRadius: 12,
  },
  ctaLabel: {
    fontSize: 7,
    color: C.amber,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.8,
    marginBottom: 6,
  },
  ctaTitle: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  ctaBody: {
    fontSize: 10,
    color: "#a1a1aa",
    lineHeight: 1.6,
    marginBottom: 12,
  },
  ctaPhone: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.amber,
  },
  ctaUrl: {
    fontSize: 9,
    color: C.textLight,
    marginTop: 2,
  },

  // ─── Footer ───
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  footerText: {
    fontSize: 8,
    color: C.textLight,
  },
  footerBrand: {
    fontSize: 8,
    color: C.textLight,
  },
  footerBrandBold: {
    color: C.text,
    fontFamily: "Helvetica-Bold",
  },
});

export function ReportPDF({ scan }: { scan: ScanReport }) {
  const sevOrder = ["critical", "high", "medium", "low", "info"];
  const sortedFindings = [...scan.findings].sort(
    (a, b) => sevOrder.indexOf(a.severity) - sevOrder.indexOf(b.severity)
  );

  const date = scan.scanned_at
    ? new Date(scan.scanned_at).toLocaleString("es-MX", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("es-MX");

  const sc = scoreColor(scan.score);
  const sbg = scoreBg(scan.score);
  const sLabel = scoreLabel(scan.score);

  const grouped = sevOrder
    .map((sev) => ({
      sev,
      items: sortedFindings.filter((f) => f.severity === sev),
    }))
    .filter((g) => g.items.length > 0);

  const spfMissing = scan.raw?.email_auth?.spf_present === false;
  const dmarcMissing = scan.raw?.email_auth?.dmarc_present === false;
  const showInsight = spfMissing || dmarcMissing;

  const sslOk = scan.raw?.ssl?.ok;
  const sslDays = scan.raw?.ssl?.days_to_expiry;
  const sslIssuer = scan.raw?.ssl?.issuer;
  const cms = scan.raw?.cms?.cms;
  const age = scan.raw?.domain_age_days;
  const dmarcPolicy = scan.raw?.email_auth?.dmarc_policy;

  // Detectar si la línea de fix es un comando técnico para usar fuente monoespaciada
  const isCode = (txt: string) =>
    /`|TXT|max-age|frame-ancestors|spf1|DMARC1|DKIM1|src 'self'|X-Frame/.test(txt);

  return (
    <Document
      author="Sabuezo"
      title={`Diagnóstico de seguridad — ${scan.domain}`}
      subject="Reporte de seguridad web"
    >
      <Page size="A4" style={s.page} wrap>
        {/* ─── Header ─── */}
        <View style={s.header} fixed>
          <View style={s.brand}>
            <View style={s.brandDot} />
            <Text style={s.brandText}>Sabuezo</Text>
            <Text style={s.brandTagline}>· anti-fraude para PyMEs</Text>
          </View>
          <Text style={s.headerRight}>sabuezo.com</Text>
        </View>

        {/* ─── Hero ─── */}
        <View style={s.hero}>
          <Text style={s.eyebrow}>Diagnóstico de Seguridad</Text>
          <Text style={s.h1}>{scan.domain}</Text>
          <Text style={s.urlLine}>{scan.url}</Text>
          <Text style={s.date}>Generado el {date}</Text>
        </View>

        {/* ─── Score Card ─── */}
        <View
          style={[
            s.scoreCard,
            { backgroundColor: sbg, borderColor: sc + "40" },
          ]}
          wrap={false}
        >
          <View style={[s.scoreCircle, { borderColor: sc }]}>
            <Text style={[s.scoreNumber, { color: sc }]}>{scan.score}</Text>
          </View>
          <View style={s.scoreInfo}>
            <Text style={[s.scoreLabelText, { color: sc }]}>{sLabel}</Text>
            <Text style={s.scoreSummary}>{scan.summary}</Text>
          </View>
        </View>

        {/* ─── Insight cross-cutting ─── */}
        {showInsight && (
          <View style={s.insight} wrap={false}>
            <Text style={s.insightLabel}>Insight crítico</Text>
            <Text style={s.insightTitle}>Tu dominio no protege tu correo</Text>
            <Text style={s.insightBody}>
              {spfMissing && "Te falta SPF. "}
              {dmarcMissing && "Te falta DMARC. "}
              Esto significa que cualquiera puede mandar correos pretendiendo
              ser de {scan.domain} a tus clientes y empleados. Lo arreglas con
              2 registros TXT en tu DNS en aproximadamente 15 minutos.
            </Text>
          </View>
        )}

        {/* ─── Hallazgos por severidad ─── */}
        {grouped.map((g) => (
          <View key={g.sev}>
            <View style={s.sectionHeader} wrap={false}>
              <Text style={s.sectionTitle}>{SEV_LABEL[g.sev]}</Text>
              <Text style={s.sectionCount}>
                {g.items.length}{" "}
                {g.items.length === 1 ? "hallazgo" : "hallazgos"}
              </Text>
            </View>
            {g.items.map((f) => {
              const sv = sevColors(f.severity);
              return (
                <View key={f.id} style={s.finding} wrap={false}>
                  <View style={s.findingHead}>
                    <Text style={s.findingTitle}>{f.title}</Text>
                    <Text
                      style={[
                        s.sevBadge,
                        { backgroundColor: sv.bg, color: sv.color },
                      ]}
                    >
                      {SEV_LABEL[f.severity]}
                    </Text>
                  </View>
                  <Text style={s.findingDesc}>{f.description}</Text>
                  <View style={s.fix}>
                    <Text style={s.fixLabel}>
                      Cómo arreglarlo · {f.fix_time_min} min
                    </Text>
                    <Text style={isCode(f.fix) ? s.fixCode : s.fixText}>
                      {f.fix}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {/* ─── Detalles técnicos ─── */}
        <View style={s.techSection} wrap={false}>
          <Text style={s.techTitle}>Detalles técnicos</Text>
          <View style={s.techGrid}>
            {sslOk !== undefined && (
              <View style={s.techCell}>
                <Text style={s.techKey}>SSL / TLS</Text>
                <Text style={s.techVal}>
                  {sslOk
                    ? sslDays !== undefined
                      ? `Válido · ${sslDays}d`
                      : "Válido"
                    : "Inválido"}
                </Text>
                {sslIssuer && (
                  <Text style={{ fontSize: 8, color: C.textLight, marginTop: 2 }}>
                    {sslIssuer}
                  </Text>
                )}
              </View>
            )}
            {cms && (
              <View style={s.techCell}>
                <Text style={s.techKey}>CMS detectado</Text>
                <Text style={s.techVal}>{cms}</Text>
              </View>
            )}
            {age !== null && age !== undefined && (
              <View style={s.techCell}>
                <Text style={s.techKey}>Edad del dominio</Text>
                <Text style={s.techVal}>
                  {age === 0 ? "Registrado hoy" : `${age} días`}
                </Text>
              </View>
            )}
            {dmarcPolicy && (
              <View style={s.techCell}>
                <Text style={s.techKey}>Política DMARC</Text>
                <Text style={s.techVal}>p={dmarcPolicy}</Text>
              </View>
            )}
            <View style={s.techCell}>
              <Text style={s.techKey}>Total de hallazgos</Text>
              <Text style={s.techVal}>{scan.findings.length}</Text>
            </View>
            <View style={s.techCell}>
              <Text style={s.techKey}>Generado por</Text>
              <Text style={s.techVal}>Sabuezo Scanner v1</Text>
            </View>
          </View>
        </View>

        {/* ─── CTA ─── */}
        <View style={s.cta} wrap={false}>
          <Text style={s.ctaLabel}>Protección continua</Text>
          <Text style={s.ctaTitle}>¿Y los mensajes sospechosos que recibes?</Text>
          <Text style={s.ctaBody}>
            Sabuezo también es un bot de WhatsApp que analiza estafas en
            segundos. Reenvíale mensajes, screenshots, correos de proveedor
            sospechosos — te dice si es estafa al instante. Para PyMEs
            latinoamericanas, gratis.
          </Text>
          <Text style={s.ctaPhone}>+52 1 614 216 6179</Text>
          <Text style={s.ctaUrl}>sabuezo.com</Text>
        </View>

        {/* ─── Footer ─── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            <Text style={s.footerBrandBold}>Sabuezo</Text>
            <Text> · Democratizando la ciberseguridad para Latinoamérica</Text>
          </Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
