import https from 'https';
import { SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME } from './config.js';
import { cachedBarangays } from './db.js';

export const getLocationFromPin = (pin: string) => {
  if (!pin) return 'Unknown Location';
  const sanitized = pin.replace(/\./g, '-');
  const parts = sanitized.split('-');
  if (parts.length < 3) return 'Unknown Location';

  const locationCode = parts[2];
  const b = cachedBarangays.find(br => br.code === locationCode);
  return b ? b.name : 'Unknown Location';
};

const TELCO_PREFIXES = {
  'Smart/TNT/Sun': ['0907','0908','0909','0910','0912','0918','0919','0920','0921','0928','0929','0930','0931','0932','0933','0934','0938','0939','0940','0941','0942','0943','0946','0947','0948','0949','0950','0951','0960','0961','0963','0964','0968','0969','0970','0981','0989','0998','0999','0922','0923','0925'],
  'Globe/TM': ['0905','0906','0915','0916','0917','0926','0927','0935','0936','0937','0945','0953','0954','0955','0956','0965','0966','0967','0973','0975','0976','0977','0978','0979','0980','0994','0995','0996','0997'],
  'DITO': ['0991','0992','0993'],
  'GOMO': ['0976']
};

export const getTelco = (phone: string) => {
  if (!phone) return 'Unknown';
  const clean = phone.replace(/[^0-9]/g, '');
  const prefix = clean.startsWith('63') ? '0' + clean.substring(2, 5) : clean.substring(0, 4);

  for (const [name, prefixes] of Object.entries(TELCO_PREFIXES)) {
    if (prefixes.includes(prefix)) return name;
  }
  return 'Local/Other';
};

export const sendSMS = async (to: string, message: string) => {
  if (!to || !message) return;
  if (!SEMAPHORE_API_KEY) {
    console.warn('[SEMAPHORE] SMS skipped because SEMAPHORE_API_KEY is not configured.');
    return false;
  }

  const formattedPhone = to.startsWith('09') ? to : (to.startsWith('63') ? '0' + to.substring(2) : to);
  const telco = getTelco(formattedPhone);

  console.log('--- SENT SMS (SEMAPHORE) ---');
  console.log(`TO: ${formattedPhone} (${telco})`);
  console.log(`MSG: ${message}`);
  console.log('----------------------------');

  try {
    const params = new URLSearchParams();
    params.append('apikey', SEMAPHORE_API_KEY);
    params.append('number', formattedPhone);
    params.append('message', message);
    if (SEMAPHORE_SENDER_NAME) params.append('sendername', SEMAPHORE_SENDER_NAME);

    const response = await fetch(`https://api.semaphore.co/api/v4/messages`, {
      method: 'POST',
      body: params
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[SEMAPHORE SUCCESS]', data);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`[SEMAPHORE ERROR] Status: ${response.status}`, errorText);
      return false;
    }
  } catch (err: any) {
    console.warn(`[SEMAPHORE FAILED] Network error connecting to Semaphore. ${err.message}`);
    return false;
  }
};
