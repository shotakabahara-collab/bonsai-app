export {};

declare global {
  interface Window {
    BonsaiPhotos?: {
      pine?: string;
      pineForPot?: (pot: string) => string;
    };
  }
}
