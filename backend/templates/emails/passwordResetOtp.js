const { absoluteUrl, escapeHtml } = require('./shared');

const otpBoxes = (code) => code.split('').map((digit) =>
  `<td class="otp-digit" align="center" valign="middle" width="52" height="60" style="width:52px;height:60px;background:#fff9f2;border:1px solid #e8c9bf;border-radius:10px;color:#594a40;font:32px/1 Georgia,'Times New Roman',serif">${digit}</td>`,
).join('<td class="otp-gap" width="8" style="width:8px;font-size:0;line-height:0">&nbsp;</td>');

module.exports = (user, code) => {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new Error('A six-digit password reset code is required.');

  const displayName = String(user?.name || '').trim().split(/\s+/)[0] || 'there';
  const name = escapeHtml(displayName);
  const imageUrl = absoluteUrl('/public/images/auth/auth-blush-heart-cake.jpg?v=20261101-real');
  const digitText = code.split('').join('   ');

  return {
    subject: 'Your password reset code is here ♡',
    text: `Hi ${displayName},\n\nWe received a request to reset your Cakes of Paradise password. Use this six-digit code to verify your identity:\n\n${digitText}\n\nThis code is valid for 10 minutes. For your security, do not share it with anyone. If you did not request a password reset, you can safely ignore this email.\n\nWith love,\nCakes of Paradise`,
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>Your password reset code</title>
  <style>
    @media screen and (max-width:620px) {
      .email-wrap { padding:12px 8px!important; }
      .email-shell { width:100%!important; }
      .email-pad { padding-left:20px!important;padding-right:20px!important; }
      .email-title { font-size:34px!important; }
      .hero-image { height:190px!important; }
      .otp-digit { width:42px!important;height:52px!important;font-size:27px!important; }
      .otp-gap { width:5px!important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#fbf2e9;color:#51443b;font-family:Georgia,'Times New Roman',serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Your six-digit Cakes of Paradise password reset code is inside.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fbf2e9">
    <tbody><tr><td align="center" class="email-wrap" style="padding:26px 14px">
      <table role="presentation" class="email-shell" width="680" cellspacing="0" cellpadding="0" border="0" style="width:680px;max-width:680px;background:#fff9f1;border:1px solid #e5c9bb;border-radius:24px;overflow:hidden;box-shadow:0 12px 32px rgba(107,82,67,.08)">
        <tbody>
          <tr><td align="center" class="email-pad" style="padding:20px 28px 16px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>
              <td width="25%" align="left" style="color:#d69491;font-size:26px">୨୧</td>
              <td align="center"><div style="color:#4f4038;font:italic 36px/.95 Georgia,'Times New Roman',serif;letter-spacing:-.5px">Cakes of Paradise<span style="color:#d8908d"> ♡</span></div><div style="padding-top:8px;color:#77685e;font:10px/1.4 Arial,sans-serif;letter-spacing:3px">CAKES · SWEET MOMENTS</div></td>
              <td width="25%" align="right" style="color:#c6958c;font:italic 14px/1.4 Georgia,'Times New Roman',serif">Sweet<br>moments ♡</td>
            </tr></tbody></table>
          </td></tr>
          <tr><td class="email-pad" style="padding:0 16px">
            <img class="hero-image" src="${escapeHtml(imageUrl)}" width="646" height="268" alt="A blush pink celebration cake, freshly made with love" style="display:block;width:100%;height:268px;object-fit:cover;border:1px solid #e8c9bf;border-radius:24px">
          </td></tr>
          <tr><td align="center" class="email-pad" style="padding:20px 48px 4px">
            <div style="color:#d59691;font-size:18px;letter-spacing:7px">✧ &nbsp; ♡ &nbsp; ✧</div>
            <h1 class="email-title" style="margin:8px 0 5px;color:#4e4038;font:normal 42px/1.15 Georgia,'Times New Roman',serif">Your OTP is Here! <span style="color:#d99c98">♡</span></h1>
            <p style="margin:0;color:#72645a;font:italic 19px/1.5 Georgia,'Times New Roman',serif">Hi ${name},</p>
            <p style="margin:2px 0 0;color:#65574e;font:17px/1.6 Georgia,'Times New Roman',serif">We received a request to reset your password for your<br class="desktop-break"> Cakes of Paradise account. Use the 6-digit code below to verify your identity.</p>
          </td></tr>
          <tr><td align="center" class="email-pad" style="padding:18px 25px 8px">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e6c8be;border-radius:15px;background:#fdf3eb;padding:9px 10px"><tbody><tr>${otpBoxes(code)}</tr></tbody></table>
            <p style="margin:11px 0 0;color:#76695e;font:14px/1.5 Georgia,'Times New Roman',serif">This code is valid for <strong style="color:#4d423a">10 minutes.</strong></p>
          </td></tr>
          <tr><td class="email-pad" style="padding:12px 48px 8px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f0e5;border:1px solid #dedccb;border-radius:13px"><tbody><tr>
              <td width="54" align="center" valign="middle" style="padding:12px 0 12px 10px;color:#75836c;font:24px Arial,sans-serif">&#128274;</td>
              <td style="padding:12px 16px 12px 7px;color:#685e53;font:14px/1.55 Georgia,'Times New Roman',serif">For your security, do not share this code with anyone.<br>If you did not request a password reset, you can safely ignore this email.</td>
            </tr></tbody></table>
          </td></tr>
          <tr><td class="email-pad" style="padding:17px 38px 12px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>
              <td align="left" valign="middle" style="width:32px;color:#d69b96;font-size:30px">♡</td>
              <td align="left" style="color:#83766b;font:italic 14px/1.5 Georgia,'Times New Roman',serif">Still here for all your sweet moments.<br><span style="color:#5e5147">With love, Team Cakes of Paradise</span></td>
              <td align="right" valign="bottom" style="color:#d99d98;font-size:27px">✧ &nbsp; ୨୧</td>
            </tr></tbody></table>
          </td></tr>
          <tr><td align="center" style="padding:11px 16px 13px;border-top:1px solid #eadbd0;color:#86776c;background:#fff5ed;font:10px/1.8 Arial,sans-serif;letter-spacing:2px">CAKES &nbsp; | &nbsp; CELEBRATIONS &nbsp; | &nbsp; SWEET MOMENTS<br><a href="${escapeHtml(absoluteUrl('/'))}" style="color:#78846e;text-decoration:underline;letter-spacing:0">Cakes of Paradise</a></td></tr>
          <tr><td align="center" style="padding:0;height:13px;background:#f0d3ce;font-size:0;line-height:0">&nbsp;</td></tr>
          <tr><td align="center" style="padding:0 0 8px;color:#d69491;font-size:24px;line-height:1">୨୧</td></tr>
        </tbody>
      </table>
      <div style="padding:12px 8px 0;color:#9b8c80;font:11px/1.5 Arial,sans-serif;text-align:center">A little sweetness, always — Cakes of Paradise ♡</div>
    </td></tr></tbody>
  </table>
</body>
</html>`,
  };
};
