import {
  HeroPlaceholder,
  ShopByCategory,
  CollectionSlides,
  BestSellers,
  MeetOurArtisans,
  ShopByOccasion,
  NewArrivals,
  FollowOurJourney,
  NewsletterStory,
} from "@/components/home";

export default function Home() {
  return (
    <>
      <HeroPlaceholder />
      <ShopByCategory />
      <CollectionSlides />
      <BestSellers />
      <MeetOurArtisans />
      <ShopByOccasion />
      <NewArrivals />
      <FollowOurJourney />
      <NewsletterStory />
    </>
  );
}