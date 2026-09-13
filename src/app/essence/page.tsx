import { EssenceJourney, type EssenceData } from "@/components/EssenceJourney";
import data from "@/data/essence-v10-1.json";
import { siteConfig } from "@/lib/site-config";
import "./essence.css";

export const metadata = {
  title: "Суть книги",
  description: data.intro,
  alternates: { canonical: siteConfig.publicUrl + "/essence/" },
};

export default function EssencePage() {
  const essence: EssenceData = data;
  return <EssenceJourney data={essence} />;
}
