export type SeedCreator = {
  name: string;
  gen?: 1 | 2 | 3;
  youtube?: { ucId: string; handle?: string; url?: string };
  chzzk?: { channelId: string; url?: string };
  tags?: string[];
};

export const STEL_SEEDS: SeedCreator[] = [
  // StelLive
  {
    name: '스텔라이브 StelLive Official',
    youtube: {
      ucId: 'UC2b4WRE5BZ6SIUWBeJU8rwg',
      handle: 'stellive_official',
      url: 'https://www.youtube.com/@stellive_official',
    },
  },
  // StelLive 1기
  {
    name: '아야츠노 유니 AYATSUNO YUNI',
    youtube: {
      ucId: 'UClbYIn9LDbbFZ9w2shX3K0g',
      handle: 'ayatsunoyuni',
      url: 'https://www.youtube.com/@ayatsunoyuni',
    },
    gen: 1,
  },
  // StelLive 2기
  {
    name: '시라유키 히나 SHIRAYUKI HINA',
    youtube: {
      ucId: 'UC1afpiIuBDcjYlmruAa0HiA',
      handle: 'shirayukihina',
      url: 'https://www.youtube.com/@shirayukihina',
    },
    gen: 2,
  },
  {
    name: '아카네 리제 AKANE LIZE',
    youtube: {
      ucId: 'UC7-m6jQLinZQWIbwm9W-1iw',
      handle: 'akanelize',
      url: 'https://www.youtube.com/@akanelize',
    },
    gen: 2,
  },
  {
    name: '네네코 마시로 NENEKO MASHIRO',
    youtube: {
      ucId: 'UC_eeSpMBz8PG4ssdBPnP07g',
      handle: 'neneko_mashiro',
      url: 'https://www.youtube.com/@neneko_mashiro',
    },
    gen: 2,
  },
  {
    name: '아라하시 타비 ARAHASHI TABI',
    youtube: {
      ucId: 'UCAHVQ44O81aehLWfy9O6Elw',
      handle: 'arahashitabi',
      url: 'https://www.youtube.com/@arahashitabi',
    },
    gen: 2,
  },
  // StelLive 3기
  {
    name: '유즈하 리코 YUZUHA RIKO',
    youtube: {
      ucId: 'UCj0c1jUr91dTetIQP2pFeLA',
      handle: 'yuzuhariko',
      url: 'https://www.youtube.com/@yuzuhariko',
    },
    gen: 3,
  },
  {
    name: '하나코 나나 HANAKO NANA',
    youtube: {
      ucId: 'UCcA21_PzN1EhNe7xS4MJGsQ',
      handle: 'hanako_nana',
      url: 'https://www.youtube.com/@hanako_nana',
    },
    gen: 3,
  },
  {
    name: '아오쿠모 린 AOKUMO RIN',
    youtube: {
      ucId: 'UCQmcltnre6aG9SkDRYZqFIg',
      handle: 'aokumorin',
      url: 'https://www.youtube.com/@aokumorin',
    },
    gen: 3,
  },
  {
    name: '텐코 시부키 TENKO SHIBUKI',
    youtube: {
      ucId: 'UCYxLMfeX1CbMBll9MsGlzmw',
      handle: 'tenkoshibuki',
      url: 'https://www.youtube.com/@tenkoshibuki',
    },
    gen: 3,
  },
];
