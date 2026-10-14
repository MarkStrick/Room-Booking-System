export const localRoomImagePattern = /^\/room-images\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|jpg|jpeg|webp|avif)$/;
export const isLocalRoomImage = (value: string) => localRoomImagePattern.test(value);

export const holidayPosterMaxLength = 460_000;
export const isHolidayPoster = (value: string) => value === '' ||
  (value.length <= holidayPosterMaxLength && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value));
