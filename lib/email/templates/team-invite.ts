export interface TeamInviteEmailProps {
  inviteeEmail: string;
  inviterName?: string;
  organizationName: string;
  role: 'admin' | 'member';
  inviteUrl: string;
  expiresInDays?: number;
}

export function generateTeamInviteEmail({
  inviteeEmail,
  inviterName,
  organizationName,
  role,
  inviteUrl,
  expiresInDays = 7,
}: TeamInviteEmailProps): { subject: string; html: string } {
  const subject = `You've been invited to join ${organizationName} on LastCall`;

  const roleDisplay = role === 'admin' ? 'Admin' : 'Team Member';
  const inviterText = inviterName ? `${inviterName} has` : 'You have been';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Team Invitation</title>
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
                  <td style="height: 4px; background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); border-radius: 16px 16px 0 0;"></td>
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
                                <span style="font-size: 32px;">&#128587;</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Heading -->
                    <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: #18181b; text-align: center; line-height: 1.3;">
                      You're Invited!
                    </h1>

                    <!-- Subheading -->
                    <p style="margin: 0 0 32px 0; font-size: 16px; color: #71717a; text-align: center; line-height: 1.6;">
                      ${inviterText} invited you to join <strong style="color: #18181b;">${organizationName}</strong> on LastCall.
                    </p>

                    <!-- Role Badge -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom: 32px;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="background-color: ${role === 'admin' ? '#fef3c7' : '#dbeafe'}; border-radius: 20px; padding: 8px 16px;">
                                <span style="font-size: 13px; font-weight: 600; color: ${role === 'admin' ? '#92400e' : '#1e40af'}; text-transform: uppercase; letter-spacing: 0.5px;">
                                  ${role === 'admin' ? '&#9733;' : '&#9679;'} ${roleDisplay}
                                </span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Features List -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fafafa; border-radius: 12px; margin-bottom: 32px;">
                      <tr>
                        <td style="padding: 24px;">
                          <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #18181b;">
                            With LastCall, you'll be able to:
                          </p>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="padding: 6px 0;">
                                <table role="presentation" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td style="width: 24px; vertical-align: top;">
                                      <span style="color: #22c55e; font-size: 16px;">&#10003;</span>
                                    </td>
                                    <td style="font-size: 14px; color: #52525b; line-height: 1.5;">
                                      Track and manage inventory in real-time
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0;">
                                <table role="presentation" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td style="width: 24px; vertical-align: top;">
                                      <span style="color: #22c55e; font-size: 16px;">&#10003;</span>
                                    </td>
                                    <td style="font-size: 14px; color: #52525b; line-height: 1.5;">
                                      Use AI-powered labeling and organization
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0;">
                                <table role="presentation" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td style="width: 24px; vertical-align: top;">
                                      <span style="color: #22c55e; font-size: 16px;">&#10003;</span>
                                    </td>
                                    <td style="font-size: 14px; color: #52525b; line-height: 1.5;">
                                      Collaborate seamlessly with your team
                                    </td>
                                  </tr>
                                </table>
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
                          <a href="${inviteUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 48px; border-radius: 12px; box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.4);">
                            Accept Invitation
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Expiry Notice -->
                    <p style="margin: 0; font-size: 13px; color: #a1a1aa; text-align: center; line-height: 1.5;">
                      This invitation will expire in ${expiresInDays} days.
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
                      This email was sent to <strong>${inviteeEmail}</strong>
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #a1a1aa;">
                      If you didn't expect this invitation, you can safely ignore this email.
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
