// TrueMate · Manifiesto de Ruta
// Cloudflare Worker: secure proxy + normalizer for BrokerSnapshot API v2
// V2: 12-hour edge cache per DOT to protect BrokerSnapshot API quota.
//
// REQUIRED SECRET (Cloudflare Worker Settings > Variables and Secrets):
//   BROKERSNAPSHOT_TOKEN = <Bearer token generated in BrokerSnapshot>
//
// Front-end example:
//   GET https://<your-worker-domain>/company?dot=2792782

const BROKERSNAPSHOT_BASE = 'https://brokersnapshot.com/api/v2';
const COMPANY_CACHE_TTL_SECONDS = 60 * 60 * 12; // 12 hours

const ALLOWED_ORIGINS = new Set([
  'https://gregorionavarro.github.io',
  'https://tools.truemategroup.com',
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://gregorionavarro.github.io';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(request),
    },
  });
}

function cleanDot(value) {
  const dot = String(value || '').replace(/\D/g, '');
  return /^\d{1,8}$/.test(dot) ? dot : null;
}

function firstDefined(...values) {
  return values.find(v => v !== undefined && v !== null && v !== '');
}

function cargoList(cargo = {}) {
  const labels = {
    genfreight: 'General Freight',
    hhg: 'Household Goods',
    metal: 'Metal: Sheets, Coils, Rolls',
    motorveh: 'Motor Vehicles',
    drivetow: 'Drive/Tow Away',
    logs: 'Logs, Poles, Beams, Lumber',
    bldgmat: 'Building Materials',
    mobilehome: 'Mobile Homes',
    machinery: 'Machinery / Large Objects',
    produce: 'Fresh Produce',
    liquids: 'Liquids / Gases',
    intermodal: 'Intermodal Containers',
    passengers: 'Passengers',
    oilfield: 'Oilfield Equipment',
    livestock: 'Livestock',
    grainfeed: 'Grain / Feed / Hay',
    coalcoke: 'Coal / Coke',
    meat: 'Meat',
    garbage: 'Garbage / Refuse',
    usmail: 'US Mail',
    chemicals: 'Chemicals',
    drybulk: 'Dry Bulk',
    coldfood: 'Refrigerated Food',
    beverages: 'Beverages',
    paperprod: 'Paper Products',
    utilities: 'Utilities',
    farmsupp: 'Farm Supplies',
    construct: 'Construction',
    waterwell: 'Water Well',
    hm_ind: 'Hazardous Materials',
  };

  return Object.entries(cargo)
    .filter(([key, value]) => value === true && labels[key])
    .map(([key]) => labels[key]);
}

function authorityAgeYears(addDate) {
  if (!addDate) return null;
  const start = new Date(addDate);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  let years = now.getUTCFullYear() - start.getUTCFullYear();
  const anniversaryPassed =
    now.getUTCMonth() > start.getUTCMonth() ||
    (now.getUTCMonth() === start.getUTCMonth() && now.getUTCDate() >= start.getUTCDate());
  if (!anniversaryPassed) years--;
  return Math.max(0, years);
}

function normalizeCompany(data) {
  const general = data.General || {};
  const authority = data.Authority || {};
  const address = data.Address || {};
  const contact = data.Contact || {};
  const equipment = data.EquipmentUnits || {};
  const totals = data.Totals || {};
  const drivers = data.Drivers || {};
  const mileage = data.Mileage || {};
  const safety = data.SafetyRating || {};
  const insuranceRequired = data.InsuranceRequired || {};
  const activeInsurance = Array.isArray(data.ActiveInsurances) ? data.ActiveInsurances : [];
  const insuranceHistory = Array.isArray(data.HistoryInsurances) ? data.HistoryInsurances : [];
  const sms = data.SmsSummary || null;

  const currentAuto = activeInsurance.find(p =>
    Number(p.insurance_type) === 0 || Number(p.bi_pd_maximum_limit) > 0
  ) || activeInsurance[0] || null;

  return {
    source: 'BrokerSnapshot',
    brokerSnapshotId: data.Id || null,
    dot: firstDefined(data.dot_number, data.dot, null),
    mc: data.docket_number ? `${data.prefix || 'MC'}-${data.docket_number}` : null,

    company: {
      legalName: general.name || null,
      statusCode: general.status_code || null,
      carrierOperationCode: general.carrier_operation || null,
      addedDate: general.add_date || null,
      lastChangedDate: general.chgn_date || null,
      authorityAgeYears: authorityAgeYears(general.add_date),
    },

    authority: {
      operatingStatus: authority.OperatingStatus || null,
      operatingStatusIndicator: authority.OperatingStatusIndicator || null,
      commonStatus: authority.common_stat || null,
      contractStatus: authority.contract_stat || null,
      brokerStatus: authority.broker_stat || null,
      propertyCarrier: authority.property_chk ?? null,
      commonRevocationPending: authority.common_rev_pend || null,
      contractRevocationPending: authority.contract_rev_pend || null,
      brokerRevocationPending: authority.broker_rev_pend || null,
    },

    address: {
      street: address.phy_str || null,
      city: address.phy_city || null,
      state: address.phy_st || null,
      zip: address.phy_zip || null,
      country: address.phy_country || null,
      mailingStreet: address.mai_str || null,
      mailingCity: address.mai_city || null,
      mailingState: address.mai_st || null,
      mailingZip: address.mai_zip || null,
    },

    contact: {
      phone: contact.phy_phone || null,
      email: contact.email_address || null,
      officer1: contact.company_officer_1 || null,
      officer2: contact.company_officer_2 || null,
    },

    operation: {
      powerUnits: firstDefined(totals.total_pwr, totals.total_trucks, null),
      trucks: totals.total_trucks ?? null,
      fleetSize: totals.fleetsize || null,
      ownedTractors: equipment.owntract ?? null,
      ownedTrailers: equipment.owntrail ?? null,
      termLeasedTractors: equipment.trmtract ?? null,
      drivers: drivers.total_drivers ?? null,
      interstateDrivers: drivers.total_inter_drivers ?? null,
      mileage: mileage.mcs150_mileage ?? null,
      mileageYear: mileage.mcs150_mileage_year ?? null,
      mcs150Date: mileage.mcs150_date || null,
      cargo: cargoList(data.CargoTransported || {}),
    },

    insurance: {
      requiredBipd: insuranceRequired.bipd_req ?? null,
      filedBipd: insuranceRequired.bipd_file ?? null,
      current: currentAuto ? {
        company: currentAuto.company_name || null,
        policyNumber: currentAuto.policy_number || null,
        effectiveDate: currentAuto.effective_date || null,
        postedDate: currentAuto.posted_date || null,
        limit: currentAuto.bi_pd_maximum_limit ?? null,
        insuranceType: currentAuto.insurance_type ?? null,
      } : null,
      active: activeInsurance.map(p => ({
        company: p.company_name || null,
        policyNumber: p.policy_number || null,
        effectiveDate: p.effective_date || null,
        postedDate: p.posted_date || null,
        limit: p.bi_pd_maximum_limit ?? null,
        insuranceType: p.insurance_type ?? null,
      })),
      history: insuranceHistory.map(p => ({
        company: p.company_name || null,
        policyNumber: p.policy_number || null,
        effectiveDate: p.effective_date || null,
        cancelEffectiveDate: p.cancel_effective_date || null,
        limit: p.bi_pd_maximum_limit ?? null,
        insuranceType: p.insurance_type ?? null,
      })),
    },

    safety: {
      rating: safety.safety_rating || null,
      ratingDate: safety.safety_rating_date || null,
      sms,
    },

    missingForQuote: [
      'Radius',
      'Garaging',
      'Current vehicle list and values',
      'Driver list / CDL experience',
      'Loss Runs',
      'IFTA',
      'Detailed commodities',
    ],
  };
}

async function brokerSnapshotFetch(env, path) {
  if (!env.BROKERSNAPSHOT_TOKEN) {
    throw new Error('BROKERSNAPSHOT_TOKEN secret is not configured');
  }

  const response = await fetch(`${BROKERSNAPSHOT_BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${env.BROKERSNAPSHOT_TOKEN}`,
      'Accept': 'application/json',
      'X-Enum-Format': 'both',
      'X-Null-Value': 'include',
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message = body?.Message || body?.message || `BrokerSnapshot HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (!body?.Success || !body?.Data) {
    const error = new Error('No company data returned by BrokerSnapshot');
    error.status = 404;
    throw error;
  }

  return body.Data;
}

function companyCacheRequest(dot) {
  return new Request(`https://truemate-cache.internal/company/${encodeURIComponent(dot)}`, {
    method: 'GET',
  });
}

async function readCompanyCache(dot) {
  const cache = caches.default;
  const cached = await cache.match(companyCacheRequest(dot));
  if (!cached) return null;
  try {
    return await cached.json();
  } catch {
    return null;
  }
}

async function writeCompanyCache(dot, payload) {
  const cache = caches.default;
  const response = new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${COMPANY_CACHE_TTL_SECONDS}`,
    },
  });
  await cache.put(companyCacheRequest(dot), response);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method !== 'GET') {
      return json(request, { ok: false, error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return json(request, {
        ok: true,
        service: 'TrueMate BrokerSnapshot Proxy',
        version: 2,
        tokenConfigured: Boolean(env.BROKERSNAPSHOT_TOKEN),
        companyCacheHours: COMPANY_CACHE_TTL_SECONDS / 3600,
      });
    }

    if (url.pathname === '/company') {
      const dot = cleanDot(url.searchParams.get('dot'));
      if (!dot) {
        return json(request, { ok: false, error: 'Valid USDOT is required' }, 400);
      }

      try {
        const cachedPayload = await readCompanyCache(dot);
        if (cachedPayload?.data) {
          return json(request, {
            ...cachedPayload,
            cache: {
              status: 'HIT',
              apiRequestUsed: false,
              ttlHours: COMPANY_CACHE_TTL_SECONDS / 3600,
              note: 'Served from TrueMate cache; no new BrokerSnapshot API request used.',
            },
          });
        }

        const upstreamData = await brokerSnapshotFetch(
          env,
          `/Company?dot=${encodeURIComponent(dot)}&include=3&includeInsurance=3&includeSos=0&includeSms=1&includeReview=0`
        );

        const payload = {
          ok: true,
          fetchedAt: new Date().toISOString(),
          data: normalizeCompany(upstreamData),
        };

        if (ctx?.waitUntil) {
          ctx.waitUntil(writeCompanyCache(dot, payload));
        } else {
          await writeCompanyCache(dot, payload);
        }

        return json(request, {
          ...payload,
          cache: {
            status: 'MISS',
            apiRequestUsed: true,
            ttlHours: COMPANY_CACHE_TTL_SECONDS / 3600,
            note: 'Fresh BrokerSnapshot query; result cached for 12 hours.',
          },
        });
      } catch (error) {
        const status = Number(error.status) || 502;
        return json(request, {
          ok: false,
          error: error.message || 'Unable to retrieve BrokerSnapshot data',
          upstreamStatus: status,
        }, status >= 400 && status < 600 ? status : 502);
      }
    }

    return json(request, { ok: false, error: 'Not found' }, 404);
  },
};
