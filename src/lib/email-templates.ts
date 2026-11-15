import { env } from "./env";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export { esc as escapeHtml };

/** Brendbuka uyğun e-poçt şablonu (Outlook üçün cədvəl əsaslı, inline üslublar). */
export function emailLayout(opts: {
  title: string;
  intro?: string;
  rows?: [string, string][];
  bodyHtml?: string;
  cta?: { label: string; url: string };
  footnote?: string;
}): string {
  const rows = (opts.rows ?? [])
    .map(
      ([k, v]) => `<tr>
        <td style="padding:8px 0;color:#5b6b67;font-size:13px;width:38%;vertical-align:top">${esc(k)}</td>
        <td style="padding:8px 0;color:#231F20;font-size:14px;font-weight:600">${esc(v)}</td>
      </tr>`,
    )
    .join("");
  const cta = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr><td style="background:#44766C;border-radius:10px">
         <a href="${esc(opts.cta.url)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none">${esc(opts.cta.label)}</a>
       </td></tr></table>`
    : "";
  return `<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#eef3f1;font-family:Poppins,Tahoma,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f1;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
    <tr><td style="background:#44766C;padding:20px 28px">
      <img src="${env.appUrl}/brand/logo-white-email.png" alt="Qarabağ Universiteti" height="44" style="display:block;height:44px;border:0">
    </td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.35;color:#16423C">${esc(opts.title)}</h1>
      ${opts.intro ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#231F20">${esc(opts.intro)}</p>` : ""}
      ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3ebe8;border-bottom:1px solid #e3ebe8;margin:8px 0">${rows}</table>` : ""}
      ${opts.bodyHtml ?? ""}
      ${cta}
      ${opts.footnote ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#6b7a76">${esc(opts.footnote)}</p>` : ""}
    </td></tr>
    <tr><td style="background:#F0F3BF;padding:14px 28px;font-size:12px;color:#16423C">
      Qarabağ Universiteti Kitabxanası · Rezervasiya sistemi<br>
      <span style="color:#5b6b67">Bu məktub avtomatik göndərilib. Suallar üçün kitabxana əməkdaşına müraciət edin.</span>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

export function plainText(opts: { title: string; intro?: string; rows?: [string, string][]; cta?: { label: string; url: string } }) {
  return [
    opts.title,
    "",
    opts.intro ?? "",
    ...(opts.rows ?? []).map(([k, v]) => `${k}: ${v}`),
    opts.cta ? `\n${opts.cta.label}: ${opts.cta.url}` : "",
    "\n— Qarabağ Universiteti Kitabxanası",
  ].join("\n");
}
