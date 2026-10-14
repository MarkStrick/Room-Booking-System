export const localRoomImagePattern = /^\/room-images\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|jpg|jpeg|webp|avif)$/;
export const isLocalRoomImage = (value: string) => localRoomImagePattern.test(value);
