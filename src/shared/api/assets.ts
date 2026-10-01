// Lo que Riot publica sobre el juego — campeones, aumentos, objetos,
// runas, hechizos—, cacheado en disco.
//
// Parte del contrato IPC: todo lo de aquí cruza el puente.

export interface ChampionData {
  [id: number]: {
    name: string;
    key: string;
    class?: string;
  };
}

// One entry of a champion sheet: the passive and the four spells, in the order
// their keys sit on the keyboard.
export interface ChampionAbility {
  // "P", "Q", "W", "E" or "R"
  key: string;
  name: string;
  iconPath: string;
  description: string;
}

// A champion as the game describes it today, rather than as a stored game saw
// it: an ability text is about the champion now, not about that match.
export interface ChampionDetail {
  championId: number;
  name: string;
  title: string;
  roles: string[];
  // Riot own two-word read on how the champion plays
  tags: string[];
  branch: string;
  abilities: ChampionAbility[];
}

export interface AugmentData {
  [id: number]: {
    name: string;
    desc: string;
    iconPath: string;
    rarity: string;
    // CommunityDragon branch this entry came from. iconPath is only valid
    // against that branch, since paths move between patches.
    branch: string;
  };
}

export interface PerkData {
  [id: number]: {
    name: string;
    /** Riot markup, como el de los objetos: pintar con RiotText. */
    shortDesc: string;
    iconPath: string;
    branch: string;
    /** Una rama entera, no una runa suelta. */
    isStyle: boolean;
  };
}

export interface ItemData {
  [id: number]: {
    name: string;
    // Riot tooltip markup (<mainText>, <passive>, <magicDamage>…), already
    // resolved — render it with RiotText, never as HTML.
    description: string;
    iconPath: string;
    branch: string;
    // What the finished item costs, and what the last step of it costs
    priceTotal: number;
    price: number;
    // What it is built from and what it builds into, by id
    from: number[];
    to: number[];
    categories: string[];
    // Anything out of the shop is an internal piece rather than an item
    inStore: boolean;
  };
}

export interface SummonerSpellData {
  [id: number]: {
    name: string;
    iconPath: string;
  };
}
