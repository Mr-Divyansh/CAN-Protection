import crypto from 'node:crypto';
import { validateOtpEnvironment } from './env.ts';

export interface OtpDispatchResult {
  verificationMode: 'development_test' | 'provider';
  providerName: string;
  devTestCode?: string;
}

export function getOtpProviderConfigStatus(): {
  valid: boolean;
  verificationMode: 'development_test' | 'provider';
  providerName: string;
  error?: string;
} {
  const status = validateOtpEnvironment(process.env);
  if (!status.valid) {
    return {
      valid: false,
      verificationMode: 'provider',
      providerName: status.provider,
      error: status.error,
    };
  }
  return {
    valid: true,
    verificationMode: status.verificationMode,
    providerName: status.providerName,
  };
}

export async function dispatchOtpCode(e164Phone: string): Promise<{
  code: string;
  dispatch: OtpDispatchResult;
}> {
  const envStatus = validateOtpEnvironment(process.env);
  if (!envStatus.valid) {
    throw new Error(envStatus.error);
  }

  const code = crypto.randomInt(100000, 1000000).toString();

  if (envStatus.provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
    const token = process.env.TWILIO_AUTH_TOKEN!.trim();
    const from = process.env.TWILIO_FROM_NUMBER!.trim();

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const body = new URLSearchParams({
      To: e164Phone,
      From: from,
      Body: `Your CAN Protection verification code is ${code}. Valid for 5 minutes. Never share this code.`,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      },
    );

    if (!response.ok) {
      throw new Error(`Twilio SMS delivery failed with status ${response.status}.`);
    }

    return {
      code,
      dispatch: {
        verificationMode: 'provider',
        providerName: envStatus.providerName,
      },
    };
  }

  if (envStatus.provider === 'msg91') {
    const authKey = process.env.MSG91_AUTH_KEY!.trim();
    const templateId = process.env.MSG91_TEMPLATE_ID!.trim();

    const response = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        authkey: authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: templateId,
        mobile: e164Phone.replace(/^\+/, ''),
        otp: code,
      }),
    });

    if (!response.ok) {
      throw new Error(`MSG91 OTP delivery failed with status ${response.status}.`);
    }

    return {
      code,
      dispatch: {
        verificationMode: 'provider',
        providerName: envStatus.providerName,
      },
    };
  }

  return {
    code,
    dispatch: {
      verificationMode: 'development_test',
      providerName: envStatus.providerName,
      devTestCode: code,
    },
  };
}
