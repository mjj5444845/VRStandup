export type AvatarId =
  | 'male-casual'
  | 'male-longsleeve'
  | 'male-shirt'
  | 'male-suit'
  | 'female-alternative'
  | 'female-casual'
  | 'female-dress'
  | 'female-tanktop';

export type AvatarProfile = {
  id: AvatarId;
  name: string;
  shortLabel: string;
  wardrobe: string;
  group: 'male' | 'female';
  obj: string;
  mtl: string;
  accent: string;
};

export const AVATARS: readonly AvatarProfile[] = [
  {
    id: 'male-casual',
    name: '林凯',
    shortLabel: 'M1',
    wardrobe: '休闲装',
    group: 'male',
    obj: '/avatars/male-casual/Smooth_Male_Casual.obj',
    mtl: '/avatars/male-casual/Smooth_Male_Casual.mtl',
    accent: '#ff9b61',
  },
  {
    id: 'male-longsleeve',
    name: '周野',
    shortLabel: 'M2',
    wardrobe: '长袖装',
    group: 'male',
    obj: '/avatars/male-longsleeve/Smooth_Male_LongSleeve.obj',
    mtl: '/avatars/male-longsleeve/Smooth_Male_LongSleeve.mtl',
    accent: '#f3b04f',
  },
  {
    id: 'male-shirt',
    name: '陈默',
    shortLabel: 'M3',
    wardrobe: '短袖衬衫',
    group: 'male',
    obj: '/avatars/male-shirt/Smooth_Male_Shirt.obj',
    mtl: '/avatars/male-shirt/Smooth_Male_Shirt.mtl',
    accent: '#63b7ff',
  },
  {
    id: 'male-suit',
    name: '顾言',
    shortLabel: 'M4',
    wardrobe: '西装',
    group: 'male',
    obj: '/avatars/male-suit/Smooth_Male_Suit.obj',
    mtl: '/avatars/male-suit/Smooth_Male_Suit.mtl',
    accent: '#8ca5ff',
  },
  {
    id: 'female-alternative',
    name: '夏岚',
    shortLabel: 'F1',
    wardrobe: '个性装',
    group: 'female',
    obj: '/avatars/female-alternative/Smooth_Female_Alternative.obj',
    mtl: '/avatars/female-alternative/Smooth_Female_Alternative.mtl',
    accent: '#ff6ca8',
  },
  {
    id: 'female-casual',
    name: '许安',
    shortLabel: 'F2',
    wardrobe: '休闲装',
    group: 'female',
    obj: '/avatars/female-casual/Smooth_Female_Casual.obj',
    mtl: '/avatars/female-casual/Smooth_Female_Casual.mtl',
    accent: '#ff8f86',
  },
  {
    id: 'female-dress',
    name: '苏晴',
    shortLabel: 'F3',
    wardrobe: '连衣裙',
    group: 'female',
    obj: '/avatars/female-dress/Smooth_Female_Dress.obj',
    mtl: '/avatars/female-dress/Smooth_Female_Dress.mtl',
    accent: '#d98cff',
  },
  {
    id: 'female-tanktop',
    name: '唐可',
    shortLabel: 'F4',
    wardrobe: '背心装',
    group: 'female',
    obj: '/avatars/female-tanktop/Smooth_Female_TankTop.obj',
    mtl: '/avatars/female-tanktop/Smooth_Female_TankTop.mtl',
    accent: '#65dec6',
  },
] as const;

export const DEFAULT_AVATAR_ID: AvatarId = 'female-casual';

export const getAvatar = (id: AvatarId) =>
  AVATARS.find((avatar) => avatar.id === id) ?? AVATARS[0];

export const isAvatarId = (value: string): value is AvatarId =>
  AVATARS.some((avatar) => avatar.id === value);
