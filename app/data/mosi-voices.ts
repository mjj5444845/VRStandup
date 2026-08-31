export type MosiVoiceGuide = {
  id: string;
  name: string;
  description: string;
  language: string;
  useCase: string;
};

export const MOSI_VOICE_GUIDE: readonly MosiVoiceGuide[] = [
  {
    id: 'c6c0a40a-ea82-4468-9a21-333d3c4a76f6',
    name: '曼波有口音版',
    description: '轻快、可爱、搞笑',
    language: '中文 · 普通话',
    useCase: '动漫与角色喜剧',
  },
  {
    id: 'f80b6698-0066-430b-88a0-f0fb8796db34',
    name: '明太祖',
    description: '高冷、沉稳、霸总',
    language: '中文 · 普通话',
    useCase: '角色与影视表达',
  },
  {
    id: 'ddc6e38b-6f55-4415-b21b-a88cad2cc1d9',
    name: 'VOX AKUMA',
    description: '慵懒、磁性、专业',
    language: '英文 · 英式英语',
    useCase: '播客与社交媒体',
  },
  {
    id: '7662a8a1-700c-466a-b66b-57ece9e2e231',
    name: '李白',
    description: '古风、热血',
    language: '中文 · 普通话',
    useCase: '影视与人物表达',
  },
  {
    id: 'f9a1416b-d006-4b77-9581-8f0e8ec1e401',
    name: '旁白 Jake',
    description: '沉稳、磁性、专业',
    language: '英文 · 英式英语',
    useCase: '角色与人物旁白',
  },
  {
    id: 'faf7f550-0627-4fc6-8db0-d3bfdad49358',
    name: '经验女教师',
    description: '高冷、自然',
    language: '中文 · 普通话',
    useCase: '教育与社交内容',
  },
  {
    id: 'fe85a513-9bf3-4ef7-aa0b-8b2d11e4db93',
    name: '少年感人声（男）',
    description: '温柔、磁性、自然',
    language: '中文 · 普通话',
    useCase: '有声书与旁白',
  },
  {
    id: '0804710c-8e5e-4b67-acda-5785ef13c309',
    name: '历史解说男声',
    description: '沉稳、磁性',
    language: '中文 · 普通话',
    useCase: '有声内容与影视解说',
  },
  {
    id: '9d1e88e9-3b9c-4992-a414-7a1cb3ff7ab5',
    name: '优雅英国女士',
    description: '温柔、磁性、自然',
    language: '英文 · 英式英语',
    useCase: '影视与人物表达',
  },
  {
    id: '806c9695-6160-404e-8722-4f788d935af3',
    name: '轻快灵动女声',
    description: '轻快、活泼、自然',
    language: '中文 · 普通话',
    useCase: '客服与轻喜剧',
  },
  {
    id: '2fdf194e-c16e-4587-9027-0d3464e09b4e',
    name: '诗词朗读',
    description: '沉稳、磁性、专业',
    language: '中文 · 普通话',
    useCase: '教育与旁白',
  },
  {
    id: '133bd03b-d717-4a55-8974-7ffc9afc1b51',
    name: '故宫纪录片',
    description: '沉稳、磁性、专业',
    language: '中文 · 普通话',
    useCase: '纪录片与旁白',
  },
  {
    id: '26838557-6890-4505-bc7c-e8198443a141',
    name: '东北虎哥',
    description: '搞笑、慵懒',
    language: '中文 · 普通话',
    useCase: '娱乐与社交媒体',
  },
  {
    id: '19411508-8731-4b68-901d-7e4b8a98e23f',
    name: '忧伤的秋',
    description: '温柔、慵懒',
    language: '中文 · 普通话',
    useCase: '影视与人物表达',
  },
  {
    id: '944eb93b-3820-49f3-b2c0-4e37a31d1161',
    name: '三农农业旁白',
    description: '轻快、磁性、专业',
    language: '中文 · 普通话',
    useCase: '纪录片与旁白',
  },
] as const;

export const MOSI_VOICE_GUIDE_BY_ID = new Map(
  MOSI_VOICE_GUIDE.map((voice) => [voice.id, voice]),
);
