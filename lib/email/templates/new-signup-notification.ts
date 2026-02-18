export interface NewSignupNotificationProps {
  userEmail: string;
  userName?: string | null;
  organizationName: string;
  signupDate: string;
}

export function generateNewSignupNotificationEmail({
  userEmail,
  userName,
  organizationName,
  signupDate,
}: NewSignupNotificationProps): { subject: string; html: string } {
  const subject = `New Client Signup: ${userEmail}`;
  const displayName = userName || userEmail.split('@')[0];

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>New Client Signup</title>
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
                  <td style="height: 4px; background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%); border-radius: 16px 16px 0 0;"></td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 48px 40px;">

                    <!-- Icon -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom: 24px;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="background-color: #eef2ff; border-radius: 50%; width: 72px; height: 72px; text-align: center; vertical-align: middle;">
                                <span style="font-size: 36px;">&#128075;</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Heading -->
                    <h1 style="margin: 0 0 12px 0; font-size: 26px; font-weight: 700; color: #18181b; text-align: center; line-height: 1.3;">
                      New Client Signup!
                    </h1>

                    <p style="margin: 0 0 32px 0; font-size: 16px; color: #71717a; text-align: center; line-height: 1.6;">
                      A new client just created an account on LastCall.
                    </p>

                    <!-- Details Card -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border-radius: 12px; margin-bottom: 32px; border: 1px solid #c7d2fe;">
                      <tr>
                        <td style="padding: 24px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="padding-bottom: 16px;">
                                <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.5px;">
                                  Name
                                </p>
                                <p style="margin: 0; font-size: 16px; font-weight: 600; color: #312e81;">
                                  ${displayName}
                                </p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding-bottom: 16px;">
                                <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.5px;">
                                  Email
                                </p>
                                <p style="margin: 0; font-size: 16px; font-weight: 600; color: #312e81;">
                                  ${userEmail}
                                </p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding-bottom: 16px;">
                                <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.5px;">
                                  Organization
                                </p>
                                <p style="margin: 0; font-size: 16px; font-weight: 600; color: #312e81;">
                                  ${organizationName}
                                </p>
                              </td>
                            </tr>
                            <tr>
                              <td>
                                <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.5px;">
                                  Signed Up
                                </p>
                                <p style="margin: 0; font-size: 16px; font-weight: 600; color: #312e81;">
                                  ${signupDate}
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
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #71717a;">
                      This is an automated notification from LastCall.
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
                &copy; ${new Date().getFullYear()} LastCall. All rights reserved.
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
