import { GraphQLClient, gql } from "graphql-request";

// Subgraph URL (Goldsky)
export const LAUNCHPAD_SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_LAUNCHPAD_SUBGRAPH_URL ||
  "https://api.goldsky.com/api/public/project_cmgscxhw81j5601xmhgd42rej/subgraphs/miner-launchpad/1.0.0/gn";

const client = new GraphQLClient(LAUNCHPAD_SUBGRAPH_URL);

// Types matching the subgraph schema
export type SubgraphLaunchpad = {
  id: string;
  totalRigs: string;
  totalRevenue: string;
  totalMinted: string;
  protocolRevenue: string;
};

export type SubgraphRig = {
  id: string;
  launchpad: { id: string };
  launcher: { id: string };
  unit: string; // Bytes address
  auction: string; // Bytes address
  lpToken: string; // Bytes address
  tokenName: string;
  tokenSymbol: string;
  epochId: string;
  revenue: string;
  teamRevenue: string;
  minted: string;
  lastMined: string;
  createdAt: string;
  createdAtBlock: string;
};

export type SubgraphAccount = {
  id: string;
  rigsLaunched: SubgraphRig[];
  rigAccounts: SubgraphRigAccount[];
};

export type SubgraphRigAccount = {
  id: string; // {rigAddress}-{accountAddress}
  rig: { id: string };
  account: { id: string };
  spent: string;
  earned: string;
  mined: string;
};

export type SubgraphEpoch = {
  id: string; // {rigAddress}-{epochId}
  rig: { id: string };
  rigAccount: { id: string; account: { id: string } };
  uri: string;
  startTime: string;
  initPrice: string;
  mined: string;
  spent: string;
  earned: string;
};

// Queries

// Get global launchpad stats
export const GET_LAUNCHPAD_STATS_QUERY = gql`
  query GetLaunchpadStats {
    launchpad(id: "launchpad") {
      id
      totalRigs
      totalRevenue
      totalMinted
      protocolRevenue
    }
  }
`;

// Get rigs with pagination and ordering
export const GET_RIGS_QUERY = gql`
  query GetRigs(
    $first: Int!
    $skip: Int!
    $orderBy: Rig_orderBy!
    $orderDirection: OrderDirection!
  ) {
    rigs(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      id
      launchpad {
        id
      }
      launcher {
        id
      }
      unit
      auction
      lpToken
      tokenName
      tokenSymbol
      epochId
      revenue
      teamRevenue
      minted
      createdAt
      createdAtBlock
    }
  }
`;

// Search rigs by name or symbol
export const SEARCH_RIGS_QUERY = gql`
  query SearchRigs($search: String!, $first: Int!) {
    rigs(
      first: $first
      where: {
        or: [
          { tokenName_contains_nocase: $search }
          { tokenSymbol_contains_nocase: $search }
          { id_contains_nocase: $search }
        ]
      }
      orderBy: minted
      orderDirection: desc
    ) {
      id
      launchpad {
        id
      }
      launcher {
        id
      }
      unit
      auction
      lpToken
      tokenName
      tokenSymbol
      epochId
      revenue
      teamRevenue
      minted
      createdAt
      createdAtBlock
    }
  }
`;

// Get a single rig by ID
export const GET_RIG_QUERY = gql`
  query GetRig($id: ID!) {
    rig(id: $id) {
      id
      launchpad {
        id
      }
      launcher {
        id
      }
      unit
      auction
      lpToken
      tokenName
      tokenSymbol
      epochId
      revenue
      teamRevenue
      minted
      createdAt
      createdAtBlock
    }
  }
`;

// Get epochs (mining history) for a rig
export const GET_EPOCHS_QUERY = gql`
  query GetEpochs($rigId: String!, $first: Int!, $skip: Int!) {
    epoches(
      where: { rig_: { id: $rigId } }
      orderBy: startTime
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      rig {
        id
      }
      rigAccount {
        id
        account {
          id
        }
      }
      uri
      startTime
      initPrice
      mined
      spent
      earned
    }
  }
`;

// Get all recent epochs (for debugging/general feed)
export const GET_ALL_EPOCHS_QUERY = gql`
  query GetAllEpochs($first: Int!, $skip: Int!) {
    epoches(
      orderBy: startTime
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      rig {
        id
      }
      rigAccount {
        id
        account {
          id
        }
      }
      uri
      startTime
      initPrice
      mined
      spent
      earned
    }
  }
`;

// Get user's stats for a specific rig
export const GET_RIG_ACCOUNT_QUERY = gql`
  query GetRigAccount($id: ID!) {
    rigAccount(id: $id) {
      id
      rig {
        id
      }
      account {
        id
      }
      spent
      earned
      mined
    }
  }
`;

// Get all RigAccounts for a user
export const GET_USER_RIG_ACCOUNTS_QUERY = gql`
  query GetUserRigAccounts($accountId: String!, $first: Int!) {
    rigAccounts(where: { account_: { id: $accountId } }, first: $first) {
      id
      rig {
        id
      }
      account {
        id
      }
      spent
      earned
      mined
    }
  }
`;

// Get account with all their data
export const GET_ACCOUNT_QUERY = gql`
  query GetAccount($id: ID!) {
    account(id: $id) {
      id
      rigsLaunched {
        id
        tokenName
        tokenSymbol
        minted
        revenue
      }
      rigAccounts {
        id
        rig {
          id
        }
        spent
        earned
        mined
      }
    }
  }
`;

// Get trending rigs (most recently mined)
export const GET_TRENDING_RIGS_QUERY = gql`
  query GetTrendingRigs($first: Int!) {
    rigs(first: $first, orderBy: lastMined, orderDirection: desc) {
      id
      launchpad {
        id
      }
      launcher {
        id
      }
      unit
      auction
      lpToken
      tokenName
      tokenSymbol
      epochId
      revenue
      teamRevenue
      minted
      lastMined
      createdAt
      createdAtBlock
    }
  }
`;

// Get top rigs by revenue (total spent)
export const GET_TOP_RIGS_QUERY = gql`
  query GetTopRigs($first: Int!) {
    rigs(first: $first, orderBy: revenue, orderDirection: desc) {
      id
      launchpad {
        id
      }
      launcher {
        id
      }
      unit
      auction
      lpToken
      tokenName
      tokenSymbol
      epochId
      revenue
      teamRevenue
      minted
      createdAt
      createdAtBlock
    }
  }
`;

// Get recent epochs (for top rigs by latest epoch spent)
export const GET_RECENT_EPOCHS_QUERY = gql`
  query GetRecentEpochs($first: Int!) {
    epoches(first: $first, orderBy: startTime, orderDirection: desc) {
      id
      rig {
        id
        launchpad {
          id
        }
        launcher {
          id
        }
        unit
        auction
        lpToken
        tokenName
        tokenSymbol
        epochId
        revenue
        teamRevenue
        minted
        createdAt
        createdAtBlock
      }
      spent
      startTime
    }
  }
`;

// API Functions

export async function getLaunchpadStats(): Promise<SubgraphLaunchpad | null> {
  try {
    const data = await client.request<{ launchpad: SubgraphLaunchpad | null }>(
      GET_LAUNCHPAD_STATS_QUERY
    );
    return data.launchpad;
  } catch {
    return null;
  }
}

export async function getRigs(
  first = 20,
  skip = 0,
  orderBy: "minted" | "createdAt" | "epochId" | "revenue" = "minted",
  orderDirection: "asc" | "desc" = "desc"
): Promise<SubgraphRig[]> {
  try {
    const data = await client.request<{ rigs: SubgraphRig[] }>(GET_RIGS_QUERY, {
      first,
      skip,
      orderBy,
      orderDirection,
    });
    return data.rigs;
  } catch {
    return [];
  }
}

export async function searchRigs(
  search: string,
  first = 20
): Promise<SubgraphRig[]> {
  try {
    const data = await client.request<{ rigs: SubgraphRig[] }>(
      SEARCH_RIGS_QUERY,
      {
        search,
        first,
      }
    );
    return data.rigs;
  } catch {
    return [];
  }
}

export async function getRig(id: string): Promise<SubgraphRig | null> {
  try {
    const data = await client.request<{ rig: SubgraphRig | null }>(
      GET_RIG_QUERY,
      {
        id: id.toLowerCase(),
      }
    );
    return data.rig;
  } catch {
    return null;
  }
}

export async function getEpochs(
  rigId: string,
  first = 50,
  skip = 0
): Promise<SubgraphEpoch[]> {
  try {
    const data = await client.request<{ epoches: SubgraphEpoch[] }>(
      GET_EPOCHS_QUERY,
      {
        rigId: rigId.toLowerCase(),
        first,
        skip,
      }
    );
    return data.epoches ?? [];
  } catch (error) {
    console.error("[getEpochs] Error:", error);
    return [];
  }
}

export async function getAllEpochs(
  first = 50,
  skip = 0
): Promise<SubgraphEpoch[]> {
  try {
    const data = await client.request<{ epoches: SubgraphEpoch[] }>(
      GET_ALL_EPOCHS_QUERY,
      {
        first,
        skip,
      }
    );
    return data.epoches ?? [];
  } catch {
    return [];
  }
}

export async function getRigAccount(
  rigId: string,
  accountId: string
): Promise<SubgraphRigAccount | null> {
  try {
    // ID format is {rigAddress}-{accountAddress}
    const id = `${rigId.toLowerCase()}-${accountId.toLowerCase()}`;
    const data = await client.request<{
      rigAccount: SubgraphRigAccount | null;
    }>(GET_RIG_ACCOUNT_QUERY, { id });
    return data.rigAccount;
  } catch {
    return null;
  }
}

export async function getUserRigAccounts(
  accountId: string,
  first = 100
): Promise<SubgraphRigAccount[]> {
  try {
    const data = await client.request<{ rigAccounts: SubgraphRigAccount[] }>(
      GET_USER_RIG_ACCOUNTS_QUERY,
      {
        accountId: accountId.toLowerCase(),
        first,
      }
    );
    return data.rigAccounts;
  } catch {
    return [];
  }
}

export async function getAccount(id: string): Promise<SubgraphAccount | null> {
  try {
    const data = await client.request<{ account: SubgraphAccount | null }>(
      GET_ACCOUNT_QUERY,
      {
        id: id.toLowerCase(),
      }
    );
    return data.account;
  } catch {
    return null;
  }
}

export async function getTrendingRigs(first = 20): Promise<SubgraphRig[]> {
  try {
    const data = await client.request<{ rigs: SubgraphRig[] }>(
      GET_TRENDING_RIGS_QUERY,
      { first }
    );
    return data.rigs;
  } catch (error) {
    console.error("[getTrendingRigs] Error:", error);
    return [];
  }
}

type EpochWithRig = {
  id: string;
  rig: SubgraphRig;
  spent: string;
  startTime: string;
};

export async function getTopRigs(first = 20): Promise<SubgraphRig[]> {
  try {
    // Fetch epochs sorted by startTime (most recent first)
    // We fetch more epochs than needed to ensure we get enough unique rigs
    const data = await client.request<{ epoches: EpochWithRig[] }>(
      GET_RECENT_EPOCHS_QUERY,
      { first: first * 10 }
    );

    // Deduplicate by rig, keeping only the FIRST (latest) epoch for each rig
    const rigMap = new Map<string, { rig: SubgraphRig; spent: number }>();

    for (const epoch of data.epoches) {
      const rigId = epoch.rig.id.toLowerCase();
      const spentAmount = parseFloat(epoch.spent);

      // Only keep the first occurrence (latest epoch) for each rig
      if (!rigMap.has(rigId)) {
        rigMap.set(rigId, { rig: epoch.rig, spent: spentAmount });
      }
    }

    // Sort by latest epoch's spent amount (descending) and return rigs
    const sortedRigs = Array.from(rigMap.values())
      .sort((a, b) => b.spent - a.spent)
      .slice(0, first)
      .map((item) => item.rig);

    return sortedRigs;
  } catch (error) {
    console.error("[getTopRigs] Error:", error);
    return [];
  }
}

// Helper to format subgraph address
export function formatSubgraphAddress(address: string): `0x${string}` {
  return address.toLowerCase() as `0x${string}`;
}

// Get top miners for a specific rig (leaderboard)
export const GET_RIG_LEADERBOARD_QUERY = gql`
  query GetRigLeaderboard($rigId: String!, $first: Int!) {
    rigAccounts(
      where: { rig_: { id: $rigId }, mined_gt: "0" }
      orderBy: mined
      orderDirection: desc
      first: $first
    ) {
      id
      rig {
        id
      }
      account {
        id
      }
      spent
      earned
      mined
    }
  }
`;

export async function getRigLeaderboard(
  rigId: string,
  first = 20
): Promise<SubgraphRigAccount[]> {
  try {
    const data = await client.request<{ rigAccounts: SubgraphRigAccount[] }>(
      GET_RIG_LEADERBOARD_QUERY,
      {
        rigId: rigId.toLowerCase(),
        first,
      }
    );
    return data.rigAccounts ?? [];
  } catch (error) {
    console.error("[getRigLeaderboard] Error:", error);
    return [];
  }
}

// Legacy compatibility - maps old function names to new ones
export const getMineHistory = getEpochs;
export const getUserRigStats = getRigAccount;
export const getUserAllStats = getUserRigAccounts;

// Legacy type aliases
export type SubgraphMine = SubgraphEpoch;
export type SubgraphUserRigStats = SubgraphRigAccount;
