export interface WelcomeEmailProps {
  userName?: string;
  userEmail: string;
  organizationName: string;
  role: 'admin' | 'member';
  dashboardUrl: string;
}

export function generateWelcomeEmail({
  userName,
  userEmail,
  organizationName,
  role,
  dashboardUrl,
}: WelcomeEmailProps): { subject: string; html: string } {
  const subject = `Welcome to ${organizationName} on LastCall! 🎉`;
  const displayName = userName || userEmail.split('@')[0];
  const roleDisplay = role === 'admin' ? 'Admin' : 'Team Member';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Welcome to LastCall</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px;">

          <!-- Logo & Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 16px; padding: 16px 20px;">
                    <span style="font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">LastCall</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);">

                <!-- Decorative Top Bar -->
                <tr>
                  <td style="height: 4px; background: linear-gradient(90deg, #22c55e 0%, #10b981 50%, #14b8a6 100%); border-radius: 16px 16px 0 0;"></td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 48px 40px;">

                    <!-- Celebration Icon -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom: 24px;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="background-color: #ecfdf5; border-radius: 50%; width: 72px; height: 72px; text-align: center; vertical-align: middle;">
                                <span style="font-size: 36px;">&#127881;</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Heading -->
                    <h1 style="margin: 0 0 12px 0; font-size: 26px; font-weight: 700; color: #18181b; text-align: center; line-height: 1.3;">
                      Welcome aboard, ${displayName}!
                    </h1>

                    <!-- Subheading -->
                    <p style="margin: 0 0 32px 0; font-size: 16px; color: #71717a; text-align: center; line-height: 1.6;">
                      You're now part of <strong style="color: #18181b;">${organizationName}</strong>. Let's get you started!
                    </p>

                    <!-- Role & Team Info Card -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border-radius: 12px; margin-bottom: 32px; border: 1px solid #bbf7d0;">
                      <tr>
                        <td style="padding: 24px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td>
                                <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">
                                  Your Role
                                </p>
                                <p style="margin: 0; font-size: 18px; font-weight: 600; color: #15803d;">
                                  ${role === 'admin' ? '&#9733; ' : ''}${roleDisplay}
                                </p>
                              </td>
                              <td align="right">
                                <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">
                                  Team
                                </p>
                                <p style="margin: 0; font-size: 18px; font-weight: 600; color: #15803d;">
                                  ${organizationName}
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Quick Start Guide -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 600; color: #18181b;">
                            Here's what you can do:
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="width: 40px; vertical-align: top;">
                                <span style="display: inline-block; background-color: #eef2ff; border-radius: 8px; width: 32px; height: 32px; text-align: center; line-height: 32px; font-size: 16px;">&#128230;</span>
                              </td>
                              <td style="padding-left: 12px;">
                                <p style="margin: 0 0 2px 0; font-size: 14px; font-weight: 600; color: #18181b;">Manage Inventory</p>
                                <p style="margin: 0; font-size: 13px; color: #71717a;">Track products, quantities, and stock levels in real-time</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="width: 40px; vertical-align: top;">
                                <span style="display: inline-block; background-color: #fef3c7; border-radius: 8px; width: 32px; height: 32px; text-align: center; line-height: 32px; font-size: 16px;">&#129302;</span>
                              </td>
                              <td style="padding-left: 12px;">
                                <p style="margin: 0 0 2px 0; font-size: 14px; font-weight: 600; color: #18181b;">AI-Powered Labeling</p>
                                <p style="margin: 0; font-size: 13px; color: #71717a;">Let AI help organize and categorize your products</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="width: 40px; vertical-align: top;">
                                <span style="display: inline-block; background-color: #dbeafe; border-radius: 8px; width: 32px; height: 32px; text-align: center; line-height: 32px; font-size: 16px;">&#128101;</span>
                              </td>
                              <td style="padding-left: 12px;">
                                <p style="margin: 0 0 2px 0; font-size: 14px; font-weight: 600; color: #18181b;">Team Collaboration</p>
                                <p style="margin: 0; font-size: 13px; color: #71717a;">Work together with your team seamlessly</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA Button -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom: 24px;">
                          <a href="${dashboardUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 48px; border-radius: 12px; box-shadow: 0 4px 14px 0 rgba(34, 197, 94, 0.4);">
                            Go to Dashboard
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Help Text -->
                    <p style="margin: 0; font-size: 14px; color: #a1a1aa; text-align: center; line-height: 1.6;">
                      Questions? Just reply to this email &mdash; we're here to help!
                    </p>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #71717a;">
                      You received this email because you joined <strong>${organizationName}</strong> on LastCall.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 24px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-top: 1px solid #e4e4e7;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bottom Footer -->
          <tr>
            <td align="center">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                &copy; 2025 LastCall. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, html };
}
