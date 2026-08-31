export type AvatarId = 'female-ch02' | 'male-ch06';

export type AvatarProfile = {
  id: AvatarId;
  name: string;
  shortLabel: string;
  wardrobe: string;
  gender: 'female' | 'male';
  model: string;
  voice: string;
  accent: string;
};

export type AudienceAvatar = {
  id: string;
  model: string;
  clip: 'SIT_Sitting_Idle1' | 'SIT_Sitting_Idle2';
};

export const AVATARS: readonly AvatarProfile[] = [
  {
    id: 'female-ch02',
    name: 'Ch02 女演员',
    shortLabel: 'F · 02',
    wardrobe: 'Mixamo · Female',
    gender: 'female',
    model: '/avatars/active/performers/female-ch02.glb',
    voice: '/audio/performers/female-test.mp3',
    accent: '#ff7e9d',
  },
  {
    id: 'male-ch06',
    name: 'Ch06 男演员',
    shortLabel: 'M · 06',
    wardrobe: 'Mixamo · Male',
    gender: 'male',
    model: '/avatars/active/performers/male-ch06.glb',
    voice: '/audio/performers/male-test.mp3',
    accent: '#43a4e8',
  },
] as const;

export const AUDIENCE_AVATARS: readonly AudienceAvatar[] = [
  {
    id: 'audience-female-ch07',
    model: '/avatars/active/audience/female-ch07.glb',
    clip: 'SIT_Sitting_Idle1',
  },
  {
    id: 'audience-female-ch21',
    model: '/avatars/active/audience/female-ch21.glb',
    clip: 'SIT_Sitting_Idle2',
  },
  {
    id: 'audience-male-ch23',
    model: '/avatars/active/audience/male-ch23.glb',
    clip: 'SIT_Sitting_Idle1',
  },
  {
    id: 'audience-male-ch31',
    model: '/avatars/active/audience/male-ch31.glb',
    clip: 'SIT_Sitting_Idle2',
  },
] as const;

export const DEFAULT_AVATAR_ID: AvatarId = 'female-ch02';

export const getAvatar = (id: AvatarId) =>
  AVATARS.find((avatar) => avatar.id === id) ?? AVATARS[0];

export const isAvatarId = (value: string): value is AvatarId =>
  AVATARS.some((avatar) => avatar.id === value);
