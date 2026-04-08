/**
 * Parliament & IPSA API Adapter
 *
 * Fetches MP interests, expenses, and parliamentary data.
 *
 * Used by: mp-interests, lobbying
 *
 * APIs:
 *  - Parliament Members API: https://members-api.parliament.uk/api/Members
 *  - Parliament Interests: https://interests-api.parliament.uk/api/v1
 *  - IPSA Expenses: https://www.theipsa.org.uk/api/download (CSV)
 *  - Register of Consultant Lobbyists: https://registeroflobbyists.uk
 *
 * No API keys required. Open Parliament Licence / OGL.
 */

const MEMBERS_API = "https://members-api.parliament.uk/api";
const INTERESTS_API = "https://interests-api.parliament.uk/api/v1";

/**
 * Fetch current MPs from the Parliament Members API.
 *
 * @param {Object} [options]
 * @param {boolean} [options.isCurrentMember] - Filter to current members (default true)
 * @param {string} [options.house] - "Commons" or "Lords" (default "Commons")
 * @param {number} [options.take] - Results per page (max 20)
 * @param {number} [options.skip] - Offset
 * @returns {Promise<{data, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function fetchMembers(options = {}) {
  const {
    isCurrentMember = true,
    house = "Commons",
    take = 20,
    skip = 0,
  } = options;

  const houseId = house === "Lords" ? 2 : 1;
  const params = new URLSearchParams({
    House: String(houseId),
    IsCurrentMember: String(isCurrentMember),
    take: String(take),
    skip: String(skip),
  });

  const url = `${MEMBERS_API}/Members/Search?${params}`;
  const resp = await fetchJSON(url);

  return {
    data: resp.items || [],
    rawPayload: resp,
    sourceTimestamp: new Date().toISOString(),
    recordCount: resp.totalResults || resp.items?.length || 0,
  };
}

/**
 * Fetch all current MPs, paginating automatically.
 *
 * @returns {Promise<{data, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function fetchAllCurrentMPs() {
  const allMembers = [];
  let skip = 0;
  const take = 20;
  let total = Infinity;

  while (skip < total) {
    const result = await fetchMembers({ take, skip });
    allMembers.push(...result.data);
    total = result.rawPayload.totalResults || allMembers.length;
    skip += take;

    // Rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  return {
    data: allMembers,
    rawPayload: { totalFetched: allMembers.length },
    sourceTimestamp: new Date().toISOString(),
    recordCount: allMembers.length,
  };
}

/**
 * Fetch registered interests for a specific MP.
 *
 * @param {number} memberId - Parliament member ID
 * @returns {Promise<Object>} - Interest data
 */
export async function fetchMemberInterests(memberId) {
  const url = `${INTERESTS_API}/Interests?MemberId=${memberId}`;
  const resp = await fetchJSON(url);
  return resp;
}

/**
 * Fetch interests for all current MPs.
 * This is expensive — ~650 API calls with rate limiting.
 * Consider using the bulk CSV from IPSA instead for expenses.
 *
 * @param {Array} members - Array of member objects from fetchAllCurrentMPs
 * @param {number} [batchSize=5] - Concurrent requests per batch
 * @returns {Promise<{data, rawPayload, sourceTimestamp, recordCount}>}
 */
export async function fetchAllInterests(members, batchSize = 5) {
  const allInterests = [];

  for (let i = 0; i < members.length; i += batchSize) {
    const batch = members.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((m) =>
        fetchMemberInterests(m.value?.id || m.id).then((interests) => ({
          memberId: m.value?.id || m.id,
          name: m.value?.nameDisplayAs || m.name || "Unknown",
          party: m.value?.latestParty?.name || m.party || "Unknown",
          constituency: m.value?.latestHouseMembership?.membershipFrom || "",
          interests,
        }))
      )
    );

    for (const r of results) {
      if (r.status === "fulfilled") allInterests.push(r.value);
    }

    // Rate limit: ~5 per second
    await new Promise((r) => setTimeout(r, 1000));

    if ((i / batchSize) % 20 === 0) {
      console.log(`[parliament] Fetched interests for ${Math.min(i + batchSize, members.length)}/${members.length} MPs`);
    }
  }

  return {
    data: allInterests,
    rawPayload: { totalProcessed: members.length, totalWithData: allInterests.length },
    sourceTimestamp: new Date().toISOString(),
    recordCount: allInterests.length,
  };
}

/**
 * Normalize MP interests data into mp-interests.json format.
 */
export function normalizeMPInterests(allInterests) {
  const categoryTotals = {};
  const partyTotals = {};
  const topEarners = [];

  for (const mp of allInterests) {
    let mpTotal = 0;
    const mpCategories = {};

    const interestItems = mp.interests?.items || mp.interests || [];
    for (const cat of interestItems) {
      const catName = cat.categoryName || cat.name || "Other";
      const items = cat.interests || cat.items || [];

      for (const item of items) {
        const value = parseMonetaryValue(item.registeredBenefit || item.value || "");
        if (value > 0) {
          mpTotal += value;
          mpCategories[catName] = (mpCategories[catName] || 0) + value;

          if (!categoryTotals[catName]) categoryTotals[catName] = { total: 0, count: 0, mps: 0 };
          categoryTotals[catName].total += value;
          categoryTotals[catName].count += 1;
        }
      }
    }

    if (mpTotal > 0) {
      topEarners.push({
        name: mp.name,
        party: mp.party,
        constituency: mp.constituency,
        totalDeclared: Math.round(mpTotal),
        categories: Object.entries(mpCategories)
          .map(([cat, val]) => ({ category: cat, value: Math.round(val) }))
          .sort((a, b) => b.value - a.value),
      });

      // Party aggregation
      if (!partyTotals[mp.party]) partyTotals[mp.party] = { total: 0, mps: 0 };
      partyTotals[mp.party].total += mpTotal;
      partyTotals[mp.party].mps += 1;
    }
  }

  topEarners.sort((a, b) => b.totalDeclared - a.totalDeclared);

  return {
    summary: {
      totalMPs: allInterests.length,
      mpsWithDeclaredInterests: topEarners.length,
      totalDeclaredValue: Math.round(topEarners.reduce((s, m) => s + m.totalDeclared, 0)),
    },
    topEarners: topEarners.slice(0, 50),
    byCategory: Object.entries(categoryTotals)
      .map(([name, data]) => ({ category: name, total: Math.round(data.total), declarations: data.count }))
      .sort((a, b) => b.total - a.total),
    byParty: Object.entries(partyTotals)
      .map(([name, data]) => ({ party: name, total: Math.round(data.total), mps: data.mps }))
      .sort((a, b) => b.total - a.total),
    metadata: {
      lastUpdated: new Date().toISOString(),
      primarySource: {
        name: "UK Parliament Register of Members' Interests",
        url: "https://www.parliament.uk/mps-lords-and-offices/standards-and-financial-interests/parliamentary-commissioner-for-standards/registers-of-interests/",
      },
      licence: "Open Parliament Licence v3.0",
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function parseMonetaryValue(str) {
  if (!str || typeof str !== "string") return 0;
  // Extract numeric value from strings like "£5,000", "between £1,000 and £5,000"
  const matches = str.match(/£([\d,]+(?:\.\d{2})?)/g);
  if (!matches) return 0;
  // Take the highest value mentioned
  const values = matches.map((m) => parseFloat(m.replace(/[£,]/g, "")));
  return Math.max(...values);
}

async function fetchJSON(url) {
  const resp = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!resp.ok) {
    throw new Error(`Parliament API ${resp.status}: ${url}`);
  }

  return resp.json();
}

export default {
  fetchMembers,
  fetchAllCurrentMPs,
  fetchMemberInterests,
  fetchAllInterests,
  normalizeMPInterests,
};
