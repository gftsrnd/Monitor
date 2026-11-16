import nodemailer from 'nodemailer';
import { logger } from './logger.js';
import { env } from './env.js';
import dayjs from 'dayjs';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  body: string;
  button?: { title: string; url: string };
}

export async function sendEmail(options: EmailOptions) {
  try {
    const transporter = nodemailer.createTransport(env.smtp.server);

    const mailOptions = {
      from: env.smtp.from,
      to: options.to,
      subject: options.subject,
      html: options.body
        ? generateSMTPHTML(options.body, options.button)
        : undefined,
    };

    // TODO: create a email model to store email history

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error('Failed to send email', error);
    throw new Error('Failed to send email');
  }
}

export function generateSMTPHTML(
  body: string,
  button?: { title: string; url: string }
) {
  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="ie=edge" />
  <title>TFG Monitor Notification</title>
</head>
<body style="margin: 0; padding: 0; -webkit-text-size-adjust: none; text-size-adjust: none; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; font-size: 16px; line-height: 1.6; color: #1a1a1a; background-color: #f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 40px 0;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 640px; margin: 0 auto; padding: 0; background-color: transparent;">
          <tr>
            <td align="center" style="padding: 0 0 24px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <img src="${env.publicUrl || 'https://monitor.tinfundinggroup.net'}/icon.png" width="64" height="64" alt="TFG Monitor" style="display: block; border: 0; height: auto; line-height: 100%; max-width: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; border-radius: 6px; margin-top: 16px;" />
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="color: #0f172a; font-size: 28px; font-weight: 600; letter-spacing: -0.5px; margin: 0; padding: 0;">TFG Monitor</h1>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="color: #64748b; font-size: 16px; margin-top: 4px; margin: 0; padding: 0;">Hệ thống Giám sát & Phân tích — Tin Funding Group</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 48px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    ${body}
                  </td>
                </tr>

                ${
                  button
                    ? `
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td align="center" bgcolor="#0f172a" style="border-radius: 6px;">
                              <a href="${button.url}" target="_blank" style="display: inline-block; font-weight: 500; text-align: center; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 16px;">${button.title}</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>`
                    : ''
                }

                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="height: 1px; background-color: #e5e7eb;"></td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td>
                    <p style="margin: 0 0 12px 0; padding: 0; color: #475569; font-size: 15px;">
                      If you did not expect to receive this email, please ignore it or contact the system administrator.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin: 0; padding: 0; color: #475569; font-size: 15px;">
                      Trân trọng,<br/>
                      TFG Monitor Team
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${
            env.publicUrl
              ? `
          <tr>
            <td align="center" style="padding-top: 12px;">
              <p style="font-size: 13px; color: #94a3b8; margin: 0; padding: 0;">
                Thông báo được gửi từ <a href="${env.publicUrl}" style="color: #64748b; text-decoration: none;">${env.publicUrl}</a>
              </p>
            </td>
          </tr>`
              : ''
          }

          <tr>
            <td style="padding: 24px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <p style="font-size: 13px; color: #64748b; margin: 0; padding: 0;">
                      © ${dayjs().year()} TFG Monitor — Tin Funding Group. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
