export type SeedCreator = {
  name: string;
  gen?: 1 | 2 | 3;
  youtube?: { ucId: string; handle?: string; url?: string };
  chzzk?: { channelId: string; url?: string };
  tags?: string[];
  x?: string;
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
    x: 'https://x.com/StelLive_kr',
  },
  // 강지
  {
    name: '강지 GANGZI1',
    youtube: {
      ucId: 'UCIVFv8AiQLqM9oLHTixrNYw',
      handle: 'GANGZI1',
      url: 'https://www.youtube.com/@GANGZI1',
    },
    chzzk: {
      channelId: 'b5ed5db484d04faf4d150aedd362f34b',
      url: 'https://chzzk.naver.com/b5ed5db484d04faf4d150aedd362f34b',
    },
    x: 'https://x.com/GANGZIIII',
  },
  // StelLive 1기
  {
    name: '아야츠노 유니 AYATSUNO YUNI',
    youtube: {
      ucId: 'UClbYIn9LDbbFZ9w2shX3K0g',
      handle: 'ayatsunoyuni',
      url: 'https://www.youtube.com/@ayatsunoyuni',
    },
    chzzk: {
      channelId: '45e71a76e949e16a34764deb962f9d9f',
      url: 'https://chzzk.naver.com/45e71a76e949e16a34764deb962f9d9f',
    },
    gen: 1,
    x: 'https://x.com/AyatsunoYuni',
  },
{
    name: '사키하네 후야 SAKIHANE HUYA',
    youtube: {
      ucId: 'UC0YQnenKBCu5sGb7H61n6HA',
      handle: 'Sakihanechannel',
      url: 'https://www.youtube.com/@Sakihanechannel',
    },
    chzzk: {
      channelId: '36ddb9bb4f17593b60f1b63cec86611d',
      url: 'https://chzzk.naver.com/36ddb9bb4f17593b60f1b63cec86611d',
    },
    gen: 1,
    x: 'https://x.com/SakihaneHuya',
  },
  // StelLive 2기
  {
    name: '시라유키 히나 SHIRAYUKI HINA',
    youtube: {
      ucId: 'UC1afpiIuBDcjYlmruAa0HiA',
      handle: 'shirayukihina',
      url: 'https://www.youtube.com/@shirayukihina',
    },
    chzzk: {
      channelId: 'b044e3a3b9259246bc92e863e7d3f3b8',
      url: 'https://chzzk.naver.com/b044e3a3b9259246bc92e863e7d3f3b8',
    },
    gen: 2,
    x: 'https://x.com/Shirayukihina_',
  },
  {
    name: '네네코 마시로 NENEKO MASHIRO',
    youtube: {
      ucId: 'UC_eeSpMBz8PG4ssdBPnP07g',
      handle: 'neneko_mashiro',
      url: 'https://www.youtube.com/@neneko_mashiro',
    },
    chzzk: {
      channelId: '4515b179f86b67b4981e16190817c580',
      url: 'https://chzzk.naver.com/4515b179f86b67b4981e16190817c580',
    },
    gen: 2,
    x: 'https://x.com/NenekoMashiro',
  },
  {
    name: '아카네 리제 AKANE LIZE',
    youtube: {
      ucId: 'UC7-m6jQLinZQWIbwm9W-1iw',
      handle: 'akanelize',
      url: 'https://www.youtube.com/@akanelize',
    },
    chzzk: {
      channelId: '4325b1d5bbc321fad3042306646e2e50',
      url: 'https://chzzk.naver.com/4325b1d5bbc321fad3042306646e2e50',
    },
    gen: 2,
    x: 'https://x.com/AkaneLize',
  },
  {
    name: '아라하시 타비 ARAHASHI TABI',
    youtube: {
      ucId: 'UCAHVQ44O81aehLWfy9O6Elw',
      handle: 'arahashitabi',
      url: 'https://www.youtube.com/@arahashitabi',
    },
    chzzk: {
      channelId: 'a6c4ddb09cdb160478996007bff35296',
      url: 'https://chzzk.naver.com/a6c4ddb09cdb160478996007bff35296',
    },
    gen: 2,
    x: 'https://x.com/ArahashiTabi',
  },

  // StelLive 3기
  {
    name: '텐코 시부키 TENKO SHIBUKI',
    youtube: {
      ucId: 'UCYxLMfeX1CbMBll9MsGlzmw',
      handle: 'tenkoshibuki',
      url: 'https://www.youtube.com/@tenkoshibuki',
    },
    chzzk: {
      channelId: '64d76089fba26b180d9c9e48a32600d9',
      url: 'https://chzzk.naver.com/64d76089fba26b180d9c9e48a32600d9',
    },
    gen: 3,
    x: 'https://x.com/TenkoShibuki',
  },
  {
    name: '아오쿠모 린 AOKUMO RIN',
    youtube: {
      ucId: 'UCQmcltnre6aG9SkDRYZqFIg',
      handle: 'aokumorin',
      url: 'https://www.youtube.com/@aokumorin',
    },
    chzzk: {
      channelId: '516937b5f85cbf2249ce31b0ad046b0f',
      url: 'https://chzzk.naver.com/516937b5f85cbf2249ce31b0ad046b0f',
    },
    gen: 3,
    x: 'https://x.com/AokumoRin',
  },
  {
    name: '하나코 나나 HANAKO NANA',
    youtube: {
      ucId: 'UCcA21_PzN1EhNe7xS4MJGsQ',
      handle: 'hanako_nana',
      url: 'https://www.youtube.com/@hanako_nana',
    },
    chzzk: {
      channelId: '4d812b586ff63f8a2946e64fa860bbf5',
      url: 'https://chzzk.naver.com/4d812b586ff63f8a2946e64fa860bbf5',
    },
    gen: 3,
    x: 'https://x.com/HanakoNana',
  },
  {
    name: '유즈하 리코 YUZUHA RIKO',
    youtube: {
      ucId: 'UCj0c1jUr91dTetIQP2pFeLA',
      handle: 'yuzuhariko',
      url: 'https://www.youtube.com/@yuzuhariko',
    },
    chzzk: {
      channelId: '8fd39bb8de623317de90654718638b10',
      url: 'https://chzzk.naver.com/8fd39bb8de623317de90654718638b10',
    },
    gen: 3, 
    x: 'https://x.com/YuzuhaRiko',
  },
];
